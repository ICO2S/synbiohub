
var namespace = require('./namespace')

var summarizeProtein = require('./summarizeProtein')
var summarizeSequence = require('./summarizeSequence')
var summarizeGenericTopLevel = require('./summarizeGenericTopLevel')
var getDisplayList = require('visbol/lib/getDisplayList').getDisplayList

var config = require('../../config')

var uriToUrl = require('../../uriToUrl')

var URI = require('sboljs').URI

function summarizeComponentDefinition(componentDefinition,req,sbol,remote,graphUri) {

    if (componentDefinition instanceof URI)
	return {
            uri: componentDefinition + '',
	    id: componentDefinition + ''
	}
    
    var summary = {
        sbhBookmark: sbhBookmark(componentDefinition),
        sbhStar: sbhStar(componentDefinition),
        igemDominant: igemDominant(componentDefinition),
        igemDiscontinued: igemDiscontinued(componentDefinition),
        isReplacedBy: isReplacedBy(componentDefinition),
        type: type(componentDefinition),
        types: types(componentDefinition),
        roles: roles(componentDefinition),
	components: summarizeComponents(componentDefinition,req),
	sequenceAnnotations: summarizeSequenceAnnotations(componentDefinition,req),
	sequenceConstraints: summarizeSequenceConstraints(componentDefinition,req),
        numSubComponents: componentDefinition.components.length,
        numSubComponentsTotal: 0,
        numSequences: 0,
	displayList: getDisplayList(componentDefinition, config, req.url.toString().endsWith('/share'), 30),
        sequences: summarizeSequences(componentDefinition,req,sbol,remote,graphUri),
	BenchlingRemotes: (Object.keys(config.get('remotes')).filter(function(e){return config.get('remotes')[e].type ==='benchling'}).length > 0),
	ICERemotes: (Object.keys(config.get('remotes')).filter(function(e){return config.get('remotes')[e].type ==='ice'}).length > 0)
    }

    summary = Object.assign(summary,summarizeGenericTopLevel(componentDefinition,req,sbol,remote,graphUri))

    summary = Object.assign(summary, { remote: summarizeRemote(componentDefinition,req) })
    
    switch(summary.type) {

        case 'Protein':
            summary.protein = summarizeProtein(componentDefinition)
            break
    }

    var uploadedBy = componentDefinition.getAnnotation(namespace.synbiohub + 'uploadedBy')

    if(uploadedBy) {

        summary.synbiohub = {
            uploadedBy: uploadedBy
        }
    }

    return summary
}

module.exports = summarizeComponentDefinition

function type(componentDefinition) {

    /* TODO pick DNA/RNA/protein if one of those types is in the list
     */
    return types(componentDefinition)[0]

}

function types(componentDefinition) {

    return componentDefinition.types.map((uri) => {

        uri = '' + uri

        var prefix = namespace.biopax

        if(uri.indexOf(prefix) === 0) {

            var biopaxTerm = uri.slice(prefix.length)

            return {
                uri: uri,
                term: uri, //biopaxTerm,
                description: { name: biopaxTerm }
            }
        }

        for(var i = 0; i < namespace.so.length; ++ i) {

            var prefix = namespace.so[i]

            if(uri.indexOf(prefix) === 0) {

                var soTerm = uri.slice(prefix.length).split('_').join(':')

                var sequenceOntology = require('./sequence-ontology')

                return {
                    uri: uri,
                    term: uri, //soTerm,
                    description: sequenceOntology[soTerm]
                }
            }
        }

        return {
            uri: uri
        }
    })
}

function igemDominant(componentDefinition) {
    
    var dominantStr = componentDefinition.getAnnotations(namespace.igem + 'dominant')
    return {
	description: dominantStr
    }

}

function isReplacedBy(componentDefinition) {
    
    var isReplacedByUri = componentDefinition.getAnnotations(namespace.dcterms + 'isReplacedBy')
    if (isReplacedByUri != '') {
        isReplacedByUri = '/' + isReplacedByUri.toString().replace(config.get('databasePrefix'),'')
        isReplacedById = isReplacedByUri.toString().replace('/public/','').replace('/1','') + ' '
	isReplacedById = isReplacedById.substring(isReplacedById.indexOf('/')+1)
	return {
	    uri: isReplacedByUri,
	    id: isReplacedById
	}
    }
    return {
	uri: isReplacedByUri
    }

}

function sbhBookmark(componentDefinition) {
    
    var bookmarkStr = componentDefinition.getAnnotations(namespace.synbiohub + 'bookmark')
    return {
	description: bookmarkStr
    }

}

function sbhStar(componentDefinition) {
    
    var starStr = componentDefinition.getAnnotations(namespace.synbiohub + 'star')
    return {
	description: starStr
    }

}

function igemDiscontinued(componentDefinition) {
    
    var discontinuedStr = componentDefinition.getAnnotations(namespace.igem + 'discontinued')
    return {
	description: discontinuedStr
    }

}

function labels(componentDefinition) {
    
    return componentDefinition.getAnnotations(namespace.rdfs + 'label')

}

function comments(componentDefinition) {

    return componentDefinition.getAnnotations(namespace.rdfs + 'comment')

}

function summarizeSequences(componentDefinition,req,sbol,remote,graphUri) {
    sequences = componentDefinition.sequences.map((sequence) => {
	return summarizeSequence(sequence,req,sbol,remote,graphUri)
    })
    sequences.forEach((sequence) => {
	sequence.url = uriToUrl(sequence)
	if(req.params.version === 'current') {
            sequence.url = sequence.url.toString().replace('/'+sequence.version, '/current')
            sequence.version = 'current'
	}
    })
    return sequences
}

function roles(sbolObject) {
 
    return sbolObject.roles.map((uri) => {

        uri = '' + uri

        for(var i = 0; i < namespace.so.length; ++ i) {

            var prefix = namespace.so[i]

            if(uri.indexOf(prefix) === 0) {

                var soTerm = uri.slice(prefix.length).split('_').join(':')

                var sequenceOntology = require('./sequence-ontology')

                return {
                    uri: uri,
                    term: soTerm,
                    description: sequenceOntology[soTerm]
                }
            }
        }

        for(var i = 0; i < namespace.go.length; ++ i) {

            var prefix = namespace.go[i]

            if(uri.indexOf(prefix) === 0) {

                var goTerm = uri.slice(prefix.length).split('_').join(':')

                var geneOntology = require('./gene-ontology')

                return {
                    uri: uri,
                    term: goTerm,
                    description: geneOntology[goTerm]
                }
            }
        }

	var igemPrefix = 'http://wiki.synbiohub.org/wiki/Terms/igem#partType/'

        if(!uri.term && uri.indexOf(igemPrefix) === 0) {

            return {
                uri: uri,
                term: uri.slice(igemPrefix.length)
            }

        }

        return {
            uri: uri
        }
    })
}

function summarizeComponents(componentDefinition,req) {
    components = []
    componentDefinition.components.forEach((component) => {
	componentResult = {}
	component.link()
	componentResult.url = uriToUrl(component)
	componentResult.defUrl = uriToUrl(component.definition)
	if (component.definition.uri) {
            componentResult.defId = component.definition.displayId
            componentResult.defName= component.definition.name && component.definition.name != '' ? component.definition.name : component.definition.displayId
	} else {
            componentResult.defId = component.definition.toString()
            componentResult.defName = ''
	}
	componentResult.typeUrl = component.access.toString().replace('http://sbols.org/v2#','http://sbolstandard.org/v2#')
	componentResult.typeStr = component.access.toString().replace('http://sbols.org/v2#','')
	componentResult.roles = roles(component)
	components.push(componentResult)
    })
    return components
}

function summarizeSequenceAnnotations(componentDefinition,req) {
    sequenceAnnotations = []
    componentDefinition.sequenceAnnotations.forEach((sequenceAnnotation) => {
	sequenceAnnotationResult = {}
	sequenceAnnotation.link()
	sequenceAnnotationResult.url = uriToUrl(sequenceAnnotation)
	sequenceAnnotationResult.roles = roles(sequenceAnnotation)
	if (sequenceAnnotation.component) {
	    sequenceAnnotationResult.compUrl = uriToUrl(sequenceAnnotation.component.definition)
	    if (sequenceAnnotation.component.definition.uri) {
		sequenceAnnotationResult.compId = sequenceAnnotation.component.definition.displayId
		sequenceAnnotationResult.compName= sequenceAnnotation.component.definition.name && sequenceAnnotation.component.definition.name != '' ? sequenceAnnotation.component.definition.name : sequenceAnnotation.component.definition.displayId
	    } else {
		sequenceAnnotationResult.compId = sequenceAnnotation.definition.toString()
		sequenceAnnotationResult.compName = ''
	    }
	}
	sequenceAnnotationResult.locations = summarizeLocations(sequenceAnnotation.locations,req)
	sequenceAnnotations.push(sequenceAnnotationResult)
    })
    return sequenceAnnotations
}

function summarizeLocations(initialLocations,req) {
    locations = []
    initialLocations.forEach((location) => {
	locationResult = {}
	locationResult.url = uriToUrl(location)
	if (location.start) {
	    locationResult.locationStr = location.start + ',' + location.end
	} else if (location.at) {
	    locationResult.locationStr = location.at + '^' + location.at+1
	} else {
	    locationResult.locationStr = 'generic'
	}
	locations.push(locationResult)
    })
    return locations
}

function summarizeSequenceConstraints(componentDefinition,req) {
    sequenceConstraints = []
    componentDefinition.sequenceConstraints.forEach((sequenceConstraint) => {
	sequenceConstraintResult = {}
	sequenceConstraint.link()
	sequenceConstraintResult.url = uriToUrl(sequenceConstraint)
	sequenceConstraintResult.restriction = { url: sequenceConstraint.restriction.toString().replace('http://sbols.org','http://sbolstandard.org'),
						 id: sequenceConstraint.restriction.toString().replace('http://sbols.org/v2#','')
					       }
	sequenceConstraintResult.subjectUrl = uriToUrl(sequenceConstraint.subject.definition)
	if (sequenceConstraint.subject.definition.uri) {
	    sequenceConstraintResult.subjectId = sequenceConstraint.subject.definition.displayId
	    sequenceConstraintResult.subjectName= sequenceConstraint.subject.definition.name && sequenceConstraint.subject.definition.name != '' ? sequenceConstraint.subject.definition.name : sequenceConstraint.subject.definition.displayId
	} else {
	    sequenceConstraintResult.subjectId = sequenceConstraint.subject.toString()
	    sequenceConstraintResult.subjectName = ''
	}
	sequenceConstraintResult.objectUrl = uriToUrl(sequenceConstraint.object.definition)
	if (sequenceConstraint.object.definition.uri) {
	    sequenceConstraintResult.objectId = sequenceConstraint.object.definition.displayId
	    sequenceConstraintResult.objectName= sequenceConstraint.object.definition.name && sequenceConstraint.object.definition.name != '' ? sequenceConstraint.object.definition.name : sequenceConstraint.object.definition.displayId
	} else {
	    sequenceConstraintResult.objectId = sequenceConstraint.object.toString()
	    sequenceConstraintResult.objectName = ''
	}
	sequenceConstraints.push(sequenceConstraintResult)
    })
    return sequenceConstraints
}
		  
function summarizeRemote(componentDefinition,req) {
    var remote
    componentDefinition.annotations.forEach((annotation) => {
	if (annotation.name === 'benchling#edit' && req.params.version === 'current') {
	    remote = { name: 'Benchling',
		       url: annotation.url
		     }
	} else if (annotation.name === 'ice#entry' && req.params.version === 'current') {
	    remote = { name: 'ICE',
		       url: annotation.url
		     }
	}
    })
    return remote
}




