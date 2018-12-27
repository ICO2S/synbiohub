
const { fetchSBOLObjectRecursive } = require('../fetch/fetch-sbol-object-recursive')
const { getContainingCollections } = require('../query/local/collection')

var retrieveCitations = require('../citations')

var loadTemplate = require('../loadTemplate')

var summarizeSBOL = require('./utils/summarizeSBOL')

var async = require('async')

var pug = require('pug')

var sparql = require('../sparql/sparql-collate')

var config = require('../config')

var URI = require('sboljs').URI

var getUrisFromReq = require('../getUrisFromReq')

const uriToUrl = require('../uriToUrl')

const request = require('request')

var postprocess_igem = require('../postprocess_igem')

var striptags = require('striptags')

var generateDataRecord = require('../bioschemas/DataRecord')

var extend = require('xtend')

module.exports = function(req, res, type) {

    typeShortName = 'Unknown'
    if (type.lastIndexOf('#')>=0 && type.lastIndexOf('#')+1 < type.length) {
	typeShortName = type.slice(type.lastIndexOf('#')+1)
	if (typeShortName === 'Component') typeShortName = 'ComponentInstance'
	else if (typeShortName === 'Module') typeShortName = 'ModuleInstance'
	else if (typeShortName === 'ComponentDefinition') typeShortName = 'Component'
	else if (typeShortName === 'ModuleDefinition') typeShortName = 'Module'
    } else if (type.lastIndexOf('/')>=0 && type.lastIndexOf('/')+1 < type.length) {
	typeShortName = type.slice(type.lastIndexOf('/')+1)
    }
    
    var locals = {
        config: config.get(),
        section: typeShortName,
        user: req.user
    }

    var meta
    var sbol
    var topLevel
    var collectionIcon 
    var remote

    var collections = []
    var submissionCitations = []
    var citations = []
    var builds = []

    var encodedProteins = []
    var otherComponents = []
    var mappings = {}

    const { graphUri, uri, designId, share, url } = getUrisFromReq(req, res)

    var templateParams = {
        uri: uri
    }

    var getCitationsQuery = loadTemplate('sparql/GetCitations.sparql', templateParams)

    var getBuildsQuery = loadTemplate('sparql/GetImplementations.sparql', templateParams)

    fetchSBOLObjectRecursive(uri, graphUri).then((result) => {
	
        sbol = result.sbol
        topLevel = result.object
        remote = result.remote

        if(!topLevel || topLevel instanceof URI) {
            locals = {
                config: config.get(),
                section: 'errors',
                user: req.user,
                errors: [ uri + ' Record Not Found: ' + topLevel ]
            }
            res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
            return Promise.reject()
        }
	meta = summarizeSBOL(typeShortName,topLevel,req,sbol,remote,graphUri)
	
    }).then(function lookupCollections() {

        return Promise.all([
	    getContainingCollections(uri, graphUri, req.url).then((_collections) => {

		collections = _collections

		collections.forEach((collection) => {

		    collection.url = uriToUrl(collection.uri)

                    const collectionIcons = config.get('collectionIcons')
                    
                    if(collectionIcons[collection.uri])
			collectionIcon = collectionIcons[collection.uri]
		})
            }),

	    sparql.queryJson(getCitationsQuery, graphUri).then((results) => {

                citations = results

            }).then(() => {

                return retrieveCitations(citations).then((resolvedCitations) => {

                    submissionCitations = resolvedCitations;

                })

            }),

            sparql.queryJson(getBuildsQuery, graphUri).then((results) => {

		builds = results
		builds.forEach((build) => {
		    build.url = uriToUrl(build.impl)
		})
            })

        ])

    }).then(function lookupEncodedProteins() {

        var query =
            'PREFIX sybio: <http://w3id.org/sybio/ont#>\n' +
        'SELECT ?subject WHERE {' +
            '   ?subject sybio:encodedBy <' + uri + '>' +
            '}'

        return sparql.queryJson(query, graphUri).then((results) => {

            encodedProteins = results.map((result) => {
                return result.subject
            })

        })

    }).then(function getOtherComponentMetaData() {

        if(meta.protein && meta.protein.encodedBy)
            otherComponents = otherComponents.concat(meta.protein.encodedBy)
                    /* todo and subcomponents */

        otherComponents = otherComponents.concat(encodedProteins)

        return Promise.all(otherComponents.map((otherComponent) => {

            return getComponentDefinitionMetadata(otherComponent, graphUri).then((res) => {

                mappings[otherComponent] = res.metaData.name

            })

        }))

    }).then(function summarizeEncodedProteins() {

        meta.encodedProteins = encodedProteins.map((uri) => {

	    return {
                uri: uri,
                name: mappings[uri],
                url: uri
	    }

        })

        if(meta.protein) {

	    if(meta.protein.encodedBy) {

                meta.protein.encodedBy = meta.protein.encodedBy.map((uri) => {

		    var prefixified = prefixify(uri, prefixes)

		    return {
                        uri: uri,
                        name: mappings[uri],
                        url: '/entry/' + prefixified.prefix + '/' + prefixified.uri
		    }

                })

	    }
        }

    }).then(function fetchFromIgem() {

	if(topLevel.wasDerivedFrom.toString().indexOf('http://parts.igem.org/') === 0) {

	    return Promise.all([

		new Promise((resolve, reject) => {

		    request.get(topLevel.wasDerivedFrom.toString() + '?action=render', function(err, res, body) {

			if(err) {
			    resolve()
			    //reject(err)
			    return
			}

			if(res.statusCode >= 300) {
			    resolve()
			    //reject(new Error('HTTP ' + res.statusCode))
			    return
			}

			meta.iGemMainPage = body
			if (meta.iGemMainPage != '') {
			    meta.iGemMainPage = postprocess_igem(meta.iGemMainPage.toString())
			}

			resolve()
		    })
		}),


		new Promise((resolve, reject) => {

		    request.get(topLevel.wasDerivedFrom.toString() + ':Design?action=render', function(err, res, body) {

			if(err) {
			    //reject(err)
			    resolve()
			    return
			}

			if(res.statusCode >= 300) {
			    //reject(new Error('HTTP ' + res.statusCode))
			    resolve()
			    return
			}

			meta.iGemDesign = body
			if (meta.iGemDesign != '') {
			    meta.iGemDesign = postprocess_igem(meta.iGemDesign.toString())
			}

			resolve()
		    })
		}),


		new Promise((resolve, reject) => {

		    request.get(topLevel.wasDerivedFrom.toString() + ':Experience?action=render', function(err, res, body) {

			if(err) {
			    //reject(err)
			    resolve()
			    return
			}

			if(res.statusCode >= 300) {
			    //reject(new Error('HTTP ' + res.statusCode))
			    resolve()
			    return
			}

			meta.iGemExperience = body
			if (meta.iGemExperience != '') {
			    meta.iGemExperience = postprocess_igem(meta.iGemExperience.toString())
			}

			resolve()
		    })
		})

	    ])

	} else {
	    return Promise.resolve()
	}

    }).then(function renderView() {

	locals.meta = meta

	// Code for generating bioschemas
        locals.metaDesc = striptags(locals.meta.description).trim()
        locals.title = locals.meta.name + ' ‒ ' + config.get('instanceName')
	locals.bioschemas = generateDataRecord(extend(locals.meta, { uri, rdfType:"https://bioschemas.org/BioChemEntity" }))
	// locals.bioschemas = generateDataRecord(extend(locals.meta, { uri }))

	if (type.startsWith('http://sbols.org/v2#')) {
	    locals.rdfType = {
		name : typeShortName,
		url : type.replace('http://sbols.org','http://sbolstandard.org')
	    }
	} else {
	    locals.rdfType = {
		name : typeShortName,
		url : type
	    }
	}

	locals.share = share
        locals.prefix = req.params.prefix

        locals.collections = collections
        locals.collectionIcon = collectionIcon
	locals.builds = builds
	
        locals.submissionCitations = submissionCitations
	locals.citationsSource = citations.map(function(citation) {
            return citation.citation
        }).join(',');

	if (typeShortName ==='Activity' || typeShortName === 'Agent' || typeShortName === 'Attachment' ||
	    typeShortName === 'Implementation' || typeShortName === 'Model' || typeShortName === 'Plan' ||
	    typeShortName === 'Sequence') {
            res.send(pug.renderFile('templates/views/'+typeShortName.toLowerCase() + '.jade', locals))
	} else if (typeShortName === 'Component' ||  typeShortName === 'Module') {
            res.send(pug.renderFile('templates/views/' + typeShortName.toLowerCase() + 'Definition.jade', locals))
	} else {
            res.send(pug.renderFile('templates/views/genericTopLevel.jade', locals))
	}

    }).catch((err) => {
    
        locals = {
            config: config.get(),
            section: 'errors',
            user: req.user,
            errors: [ err.stack ]
        }
        res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
    })
	
};


