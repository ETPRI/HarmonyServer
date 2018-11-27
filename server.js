/*

small web server that serves static files and a
REST API into a database

*/

var http = require('http');
var fs   = require('fs');
var path = require('path');
var url  = require('url');
var uuidv1 = require('uuid/v1');
var integrityClass = require('./integrity');
var CRUDclass = require('./CRUD');
var backupClass = require('./backup');
const config = require('./config');

// start running neo4j code
const neo4j  = require('neo4j-driver').v1;
// Create a driver instance, for the user neo4j with password neo4j.
// It should be enough to have a single driver per database per application.
const driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", config.neo4j.password));

let backup = new backupClass(config, fs, driver, stringEscape);
let integrity = new integrityClass(driver, uuidv1, stringEscape, true);
let CRUD = new CRUDclass(uuidv1, integrity, driver);

http.createServer(function (request, response) {
    let source = "Remote ";
    if (request.headers.host === `127.0.0.1:${config.port}` || request.headers.host === `localhost:${config.port}`) {
      source = "Local ";
    }

    console.log(source, 'request ', request.url);

    var q = url.parse(request.url, true);
    response.setHeader('Access-Control-Allow-Origin', '*');

    if (q.pathname === "/get"){
      // reading a form
      console.log("get: %s\n", JSON.stringify(q.query));
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/plain');
      runGremlin(q.query.gremlinSteps, response);
      return;
    }
    else if (request.method === "POST") {
      // REST API
      let body = '';
      request.on('data', chunk => {
          body += chunk.toString(); // convert Buffer to string
      });
      request.on('end', () => {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain');
        var obj = JSON.parse(body);
        switch (obj.server) {
          case "neo4j":
            runNeo4j(obj.query, response);
            break;
          case "gremlin":
            runGremlin2(obj.query, response);
            break;
          case "backupNeo4j":
            backup.processBackup(obj.query, response);
            break;
          case "CRUD":
            CRUD.runCRUD(obj, response);
            break;
          case "file":
            runFileRequest(obj, response);
            break;
          default:
            console.log("Error server = %s\n", obj.server );
        }
      });
      return;
    }

    // serve static file
    var filePath = './servedFiles';  // default location of served files relative to where server is
    if (request.url == "/") {
      filePath += "/view/app.html";
  // filePath += "/admin/Neo4jRun.html";
  //filePath += "_app.html";
    } else {
      // try to find static file to return
      filePath += request.url ;
    }

    var extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.svg': 'application/image/svg+xml'
    };

    var contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT'){
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                response.end();
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

}).listen(config.port);

console.log(`Server running at http://127.0.0.1:${config.port}`);

test();

integrity.all();

// test/one-time code goes here---------------------------------------------
function test() {
}

// neo4j  --------------------------------------

function runNeo4j(query, response) {
    console.log('runNeo4j - %s',query);

    if (query === 'server:exit') {
        // stop the node server
        driver.close();
        process.exit(0);
        return;
    }

    const session = driver.session();
    var ret = [];

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
        const obj={};
        for (let i=0; i< record.length; i++) {
          obj[record.keys[i]]=record._fields[i];
        }
        ret.push(obj);
          console.log("%s/n",JSON.stringify(obj));
        },
        onCompleted: function () {
          response.end(JSON.stringify(ret));
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
}

function runFileRequest(obj, response) {
  switch (obj.function) {
    case "saveFile":
      saveFile(obj.query, response);
      break;
    case "downloadFile":
      downloadFile(obj.query, response);
    default:
      console.log(`Error: File function ${obj.function} does not exist`);
      break;
  }
}

// Query may contain: fileText, fileType, userGUID, nodeGUID, copyUserGUID and copyNodeGUID
function saveFile(query, response) {
  if (query.userGUID && query.nodeGUID) {
    const basePath = `${config.userFiles}/${query.userGUID}`;
    const nodePath = `${basePath}/${query.nodeGUID}`;

    // Create the folder for this user and for this node, if they don't already exist
    if (!(fs.existsSync(basePath))) {
      fs.mkdirSync(basePath);
    }
    if (!(fs.existsSync(nodePath))) {
      fs.mkdirSync(nodePath);
    }

    if (query.copyUserGUID && query.copyNodeGUID) {
      const copyUserPath = `${config.userFiles}/${query.copyUserGUID}`;
      const copyNodePath = `${copyUserPath}/${query.copyNodeGUID}`;
      if (fs.existsSync(copyUserPath) && fs.existsSync(copyNodePath)) {
        fs.copyFileSync(copyNodePath, nodePath); // should copy the contents of the source folder to the new folder
      }
    } // end if (query included copy user GUID and copy node GUID; a folder needs to be copied)

    if (query.fileText) {
      // Get the highest numbered file currently in the folder - 0 if there are none
      let currentFiles = fs.readdirSync(nodePath).map(str => parseInt(str));
      let maxValue = Math.max(currentFiles);
      if(maxValue === -Infinity || isNaN(maxValue)) {
        maxValue = 0;
      }

      // Get the file type - default to .txt
      let type = query.fileType;
      if (!type) {
        type = 'txt';
      }

      // Save the file
      const fileName = `${nodePath}/${maxValue + 1}.${type}`;
      fs.writeFile(fileName, query.fileText, (err) => {
        if (err) console.log(`Error while saving file: ${err}`);
      });
    } // end if (the query included a file buffer)
  } // end if (the query included a path and can be executed)

  // Finally, return an empty response to the client, just so it knows the request is done
  response.end("");
}

function downloadFile(query, response) { // For now, query includes only the file GUID - not the user GUID. Find the user first, then the file
  const session = driver.session();
  const findOwner = `match (n:file {M_GUID:"${query.fileGUID}"})-[:Owner]->(a) return a.M_GUID as GUID`;
  const result = [];
  session
    .run(findOwner)
    .subscribe({onNext: function(record) {
      const obj={};
      for (let i=0; i< record.length; i++) {
        obj[record.keys[i]]=record._fields[i];
      }
      result.push(obj);
    },
      onCompleted: function() {
        if (result.length === 1) {
          const userGUID = result[0].GUID;

          const basePath = `${config.userFiles}/${userGUID}`;
          const nodePath = `${basePath}/${query.fileGUID}/${query.version}.${query.type}`;

          if (fs.existsSync(nodePath)) {
            const data = fs.readFileSync(nodePath, 'utf8');
            response.end(data);
            session.close();
          }
          else {
            response.end("Error: File could not be found");
            session.close();
          }
        }
        else {
          response.end("Error: File's owner could not be found");
          session.close();
        }
      },
      onError: function (error) {
        console.log(error);
      }
    });
}

// ------------------------------------------ Gremlin stuff ---------

// const Gremlin = require('gremlin');
// const async   = require('async');
//
// const client = Gremlin.createClient(
//     443,
//     config.endpoint,
//     {
//         "session": false,
//         "ssl": true,
//         "user": `/dbs/${config.database}/colls/${config.collection}`,
//         "password": config.primaryKey
//     }
// );
//
// function runGremlin2(query, response) {
//     console.log('runGremlin - %s',query);
//     return(client.execute(query, { }, (err, results) => {
//         if (err) {
//           console.error(err);
//           response.end(err);
//         } else {
//           const ret = JSON.stringify(results,null,4);
//           console.log("Result: %s\n", ret);
//           response.end(ret);
//         }
//     })) ;
// }

//--------------Helper functions---------------------------------------------

function stringEscape(text) {
  let string = JSON.stringify(text);
  string = string.substring(1, string.length-1);
  // if (string.indexOf("'") > -1) {
  //   string = string.replace(/'/g, "\\'");
  // }
  return string;
}
