const config = require('../config')
const request = require('request')
const fs = require('mz/fs')
const sparqlResultsToArray = require('./sparql-results-to-array')
const spawn = require('child_process').spawn
const tmp = require('tmp-promise')
var path = require('path')

var exec = require('child_process').exec

function escapeSparqlIRI (uri) {
  return '<' + uri + '>'
}

function updateQuery (sparql, graphUri, accept) {
  const triplestoreConfig = config.get('triplestore')

  graphUri = graphUri || triplestoreConfig.defaultGraph

  if (config.get('logSparqlQueries')) { console.log(sparql) }

  return new Promise((resolve, reject) => {
    request({

      method: 'POST',
      url: triplestoreConfig.sparqlEndpoint + '-auth',
      qs: {
        query: sparql,
        'default-graph-uri': graphUri
      },
      auth: {
        user: triplestoreConfig.username,
        pass: triplestoreConfig.password,
        sendImmediately: false
      },
      headers: {
        accept: accept
      }

    }, (err, res, body) => {
      if (err) {
        reject(err)
        return
      }

      if (res.statusCode >= 300) {
        reject(new Error(body))
        return
      }

      resolve({
        type: res.headers['content-type'],
        statusCode: res.statusCode,
        body: body
      })
    })
  })
}

function updateQueryJson (sparql, graphUri) {
// const timer = Timer('sparql query')

  return updateQuery(sparql, graphUri, 'application/sparql-results+json').then(parseResult)

  function parseResult (res) {
    // timer()

    // console.log('res status code is ' + res.statusCode)

    var results = JSON.parse(res.body)

    return Promise.resolve(sparqlResultsToArray(results))
  }
}

function query (sparql, graphUri, accept, explorer = false) {
  const triplestoreConfig = config.get('triplestore')

  graphUri = graphUri || triplestoreConfig.defaultGraph

  if (config.get('logSparqlQueries')) { console.log(sparql) }

  var endpoint

  if (explorer) {
    endpoint = config.get('SBOLExplorerEndpoint')
  } else {
    endpoint = triplestoreConfig.sparqlEndpoint
  }

  let qs = {
    'default-graph-uri': graphUri
  }

  if (sparql) { qs.query = sparql }

  return new Promise((resolve, reject) => {
    request({

      method: 'get',
      url: endpoint,
      qs: qs,
      headers: {
        accept: accept
      }

    }, (err, res, body) => {
      if (err) {
        reject(err)
        return
      }

      if (res.statusCode >= 300) {
        reject(new Error(body))
        return
      }

      resolve({
        type: res.headers['content-type'],
        statusCode: res.statusCode,
        body: body
      })
    })
  })
}

function queryJson (sparql, graphUri, explorer = false) {
// const timer = Timer('sparql query')

  if (sparql.includes('LIMIT')) {
    return query(sparql, graphUri, 'application/sparql-results+json', explorer).then(parseResult, handleError)
  } else {
    return queryJsonStaggered(sparql, graphUri, explorer)
  }

  function parseResult (res) {
    // timer()
    // console.log('res status code is ' + res.statusCode)

    var results = JSON.parse(res.body)

    return Promise.resolve(sparqlResultsToArray(results))
  }

  function handleError (error) {
    if (explorer) {
      console.log(error + ' -> retrying query with SBOLExplorer bypassed')
      return query(sparql, graphUri, 'application/sparql-results+json', false).then(parseResult).catch((err) => {
        console.error('Virtuoso not responding search')
        console.error(err.stack)
        return Promise.resolve([])
      })
    } else {
      console.error('Virtuoso not responding')
      console.error(error.stack)
      return Promise.resolve([])
    }
  }
}

function queryJsonStaggered (sparql, graphUri, explorer = false) {
  var offset = 0
  var limit = config.get('staggeredQueryLimit')

  var resultsUnion = []
  if (!sparql.includes('ORDER BY')) {
    let bound = sparql.match(/\?[A-Za-z0-9_]+/)
    if (bound !== null) {
      let term = bound[0]
      sparql = sparql + ' ORDER BY ' + term
    }
  }

  return performQuery()

  function performQuery () {
    console.log('queryJsonStaggered: offset ' + offset + ', limit ' + limit + ', ' + resultsUnion.length + ' results so far')

    return queryJson(sparql + ' OFFSET ' + offset + ' LIMIT ' + limit, graphUri, explorer).then((results) => {
      // console.log('qj results')
      // console.log(JSON.stringify(results))

      if (results.length === 0) {
        return Promise.resolve(resultsUnion)
      } else {
        Array.prototype.push.apply(resultsUnion, results)

        offset += limit

        return performQuery()
      }
    })
  }
}

// Removed staggering since it is causing incomplete deletes
function deleteStaggered (sparql, graphUri) {
  // var limit = config.get('staggeredQueryLimit')

  return performQuery()

  function performQuery () {
    // console.log('deleteStaggered: limit ' + limit)

    return updateQueryJson(sparql, graphUri).then((results) => {
      // hacks! delete succeeds even if nothing was deleted, but it
      // does give us a nice message.
      //
      if (results[0]['callret-0'].indexOf('nothing to do') !== -1) {
        return Promise.resolve()
      } else {
        return performQuery()
      }
    })
  }
}

function upload (graphUri, data, type) {
  const triplestoreConfig = config.get('triplestore')

  graphUri = graphUri || triplestoreConfig.defaultGraph

  return new Promise((resolve, reject) => {
    request({

      method: 'POST',
      url: triplestoreConfig.graphStoreEndpoint,
      qs: {
        'graph-uri': graphUri
      },
      auth: {
        user: triplestoreConfig.username,
        pass: triplestoreConfig.password,
        sendImmediately: false
      },
      headers: {
        'content-type': type
      },
      body: data

    }, (err, res, body) => {
      if (err) {
        reject(err)
        return
      }

      if (res.statusCode >= 300) {
        reject(new Error(body))
        return
      }

      resolve(body)
    })
  })
}

function uploadSmallFile (graphUri, filename, type) {
  const triplestoreConfig = config.get('triplestore')

  graphUri = graphUri || triplestoreConfig.defaultGraph

  return new Promise((resolve, reject) => {
    console.log('sparql upload file: ' + filename)
    console.log('gui ' + graphUri)

    /* TODO: it would be very nice to stream the file to the request
* instead of loading it all into memory.
* unfortunately, with auth: { sendImmediately: false }, the file gets
* streamed to the initial request (which will fail), and then when the
* retry request with authentication happens requestjs sends content
* length of 0.
*/
    fs.readFile(filename).then((contents) => {
      request({

        method: 'POST',
        url: triplestoreConfig.graphStoreEndpoint,
        qs: {
          'graph-uri': graphUri
        },
        auth: {
          user: triplestoreConfig.username,
          pass: triplestoreConfig.password,
          sendImmediately: false
        },
        headers: {
          'content-type': type
        },
        body: contents

      }, (err, res, body) => {
        if (err) {
          reject(err)
          return
        }

        console.log('uploadfile done; ' + res.statusCode)
        console.log(body)

        if (res.statusCode >= 300) {
          reject(new Error(body))
          return
        }

        resolve(body)
      })
    })
  })
}

function uploadFile (graphUri, filename, type) {
  return tmp.dir().then((tempDir) => {
    console.log('file before splitting ' + filename)
    console.log('splitting RDF to n3 in temp dir ' + tempDir.path)

    return new Promise((resolve, reject) => {
      const splitProcess = spawn(path.join(__dirname, '/../../scripts/split_to_n3.sh'), [
        filename
      ], {
        cwd: tempDir.path
      })

      splitProcess.stderr.on('data', (data) => {
        console.log('[split_to_n3.sh]', data.toString())
      })

      splitProcess.on('close', (exitCode) => {
        if (exitCode !== 0) {
          reject(new Error('split_to_n3 returned exit code ' + exitCode))
          return
        }

        resolve(tempDir.path)
      })
    })
  }).then((tempDir) => {
    return fs.readdir(tempDir).then((files) => {
      var filesToUpload = files.filter(
        (filename) => filename.indexOf('upload_') === 0)

      // var total = filesToUpload.length

      console.log(filesToUpload + ' chunks to upload')

      return uploadNextFile()

      function uploadNextFile () {
        if (filesToUpload.length > 0) {
          var nextFile = tempDir + '/' + filesToUpload[0]
          filesToUpload = filesToUpload.slice(1)

          console.log('Uploading n3 chunk: ' + nextFile)

          return uploadSmallFile(graphUri, nextFile, 'text/n3')
            .then(() => fs.unlink(nextFile))
            .then(() => uploadNextFile())
        } else {
          return exec('rm -r ' + tempDir)
        }
      }
    })
  })
}

module.exports = {

  escape: require('pg-escape'),
  escapeIRI: escapeSparqlIRI,
  updateQuery: updateQuery,
  updateQueryJson: updateQueryJson,
  query: query,
  queryJson: queryJson,
  queryJsonStaggered: queryJsonStaggered,
  deleteStaggered: deleteStaggered,
  upload: upload,
  uploadFile: uploadFile
}
