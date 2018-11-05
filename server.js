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
