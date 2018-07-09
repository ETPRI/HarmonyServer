/*

small web server that serves static files and a
REST API into a database

*/


var http = require('http');
var fs   = require('fs');
var path = require('path');
var url  = require('url');

http.createServer(function (request, response) {
    console.log('request ', request.url);
    var q = url.parse(request.url, true);

    if (q.pathname === "/get"){
      // reading a form
      console.log("get: %s\n", JSON.stringify(q.query));
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/plain');
      runGremlin(q.query.gremlinSteps, response);
      return;
    } else if (request.method === "POST") {
      // REST API
      let body = '';
      request.on('data', chunk => {
          body += chunk.toString(); // convert Buffer to string
      });
      request.on('end', () => {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain');
        var obj = JSON.parse(body);
        if (obj.server === "neo4j") {
          runNeo4j(obj.query, response);
        } else if (obj.server === "gremlin") {
          runGremlin2(obj.query, response);
        } else {
          console.log("Error server = %s\n", obj.server );
        }
      });
      return;
    }

    // serve static file
    var filePath = './servedFiles';  // default location of served files relative to where server is
    if (request.url == "/") {
      filePath += "/index.html";
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

}).listen(8125);

console.log('Server running at http://127.0.0.1:8125');

// neo4j  --------------------------------------
const neo4j  = require('neo4j-driver').v1;

// Create a driver instance, for the user neo4j with password neo4j.
// It should be enough to have a single driver per database per application.
const driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "paleo3i"));
//const driver = new neo4j.driver("bolt://localhost:7687", neo4j.auth.driver("neo4j", "paleo3i"));
//const driver = neo4j.v1.driver("bolt://localhost", neo4j.v1.auth.basic("neo4j", "paleo3i"));

// Close the driver when application exits.
// This closes all used network connections.
// process.on('exit', (code) => {
//   driver.close();
//   console.log(`About to exit with code: ${code}`);
// });


function runNeo4j(query, response)
{
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

const Gremlin = require('gremlin');
const config  = require('./config');
const async   = require('async');

const client = Gremlin.createClient(
    443,
    config.endpoint,
    {
        "session": false,
        "ssl": true,
        "user": `/dbs/${config.database}/colls/${config.collection}`,
        "password": config.primaryKey
    }
);

function runGremlin2(query, response)
{
    console.log('runGremlin - %s',query);
    return(client.execute(query, { }, (err, results) => {
        if (err) {
          console.error(err);
          response.end(err);
        } else {
          const ret = JSON.stringify(results,null,4);
          console.log("Result: %s\n", ret);
          response.end(ret);
        }
    })) ;
}
//
// // this is sequential code, add asyc back, not sure the best way
// function runGremlin(query, response)
// {
//     console.log('runGremlin - %s',query);
//     client.execute(query, { }, (err, results) => {
//         if (err) {
//           console.error(err);
//           response.end(err);
//         } else {
//           const ret = JSON.stringify(results);
//           console.log("Result: %s\n", ret);
//           response.end(ret);
//         }
//
//     });
// }
