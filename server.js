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
    response.setHeader('Access-Control-Allow-Origin', '*');

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
        switch (obj.server) {
          case "neo4j":
            runNeo4j(obj.query, response);
            break;
          case "gremlin":
            runGremlin2(obj.query, response);
            break;
          case "backupNeo4j":
            processBackup(obj.query, response);
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

}).listen(8080);

console.log('Server running at http://127.0.0.1:8080');

// neo4j  --------------------------------------
const neo4j  = require('neo4j-driver').v1;

// Create a driver instance, for the user neo4j with password neo4j.
// It should be enough to have a single driver per database per application.
const driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "paleo3i"));
startNeo4j();
//const driver = new neo4j.driver("bolt://localhost:7687", neo4j.auth.driver("neo4j", "paleo3i"));
//const driver = neo4j.v1.driver("bolt://localhost", neo4j.v1.auth.basic("neo4j", "paleo3i"));

// Close the driver when application exits.
// This closes all used network connections.
// process.on('exit', (code) => {
//   driver.close();
//   console.log(`About to exit with code: ${code}`);
// });

function startNeo4j() {
  console.log("Checking metadata...");
  const session = driver.session();
  var nodes = [];
  var fields = [];
  query = "MATCH (n:M_MetaData) return n.name, n.fields";
  session
    .run(query)
    .subscribe({
      onNext: function (record) {
        nodes.push(record._fields[0]);
        fields.push(record._fields[1]);
      },
      onCompleted: function () {
        for (let i = 0; i < nodes.length; i++) {
          getKeys(nodes[i], JSON.parse(fields[i]));
        }
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
  });
}

function getKeys(node, fields) {
  const session = driver.session();
  var keys = [];
  let query = `MATCH (p:${node}) unwind keys(p) as key RETURN distinct key`;
  session
    .run(query)
    .subscribe({
      onNext: function (record) {
        keys.push(record._fields[0]);
      },
      // at this point, we have a keys array which includes all keys found for this node type,
      // and a fields object which should contain a key for every field. If it doesn't, then that key needs to be added.
      // So go through all the keys from the DB and add any that are missing to fields.
      onCompleted: function () {
        let mismatch = false;
        for (let i = 0; i < keys.length; i++) {
          if (!(keys[i] in fields) && keys[i].slice(0,2) !== 'M_') { // If this key is missing from the fields object, and isn't metadata
            fields[keys[i]] = {label: keys[i]}; // assume its name is also its label
            console.log (`Mismatch! Node type ${node} was missing key ${keys[i]}; adding now.`);
            mismatch = true;
          }
        }
        if (mismatch) {
          updateFields(node, fields);
        }
        else {
          console.log (`Node type ${node} has no mismatches.`);
        }
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
  });
}

function updateFields(node, fields) {
  const session = driver.session();
  let query = `MATCH (m:M_MetaData {name:"${node}"}) set m.fields = "${stringEscape(JSON.stringify(fields))}"`;
  session
    .run(query)
    .subscribe({
      onCompleted: function () {
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
  });

}

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

// -----------------------------------Backup code------------
const blocksize = 100;
let finalPath = "";
let nodeFiles = 1;
let relFiles = 1;

function processBackup(query, response) {
  switch (query.functionName) {
    case "findNodes":
      nodeFiles = 1; // reset to defaults
      relFiles = 1;
      makeDirectory(query, response);
      break;
    case "findRels":
      findRels(query, response);
      break;
    case "backupNodes":
      backupNodes(query, response);
      break;
    case "backupRels":
      backupRels(query, response);
      break;
    case "startRestore":
      nodeFiles = 1; // reset to defaults
      relFiles = 1;
      getNodeData(query, response);
      break;
    case "getRelData":
      getRelData(query, response);
      break;
    case "restoreNodes":
      restoreNodes(query, response);
      break;
    case "restoreRels":
      restoreRels(query, response);
      break;
    default:
    console.log("Error function = %s\n", query.functionName);
  }
}

function makeDirectory(query, response) {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const basePath = `${config.neo4jBackup}/${todayString}`;
  finalPath = basePath; // reset just in case it's been changed

  let number = 2;

  while (fs.existsSync(finalPath)) {
    finalPath = `${basePath}(${number})`;
    number++;
  }

  fs.mkdir(`${finalPath}`, function(err) {
    if (err) {
      console.log(err);
    }
    else {
      findNodes(query, response);
    }
  });

}

function findNodes(query, response) {
  var nodesDone = [];
  var data = [];

  console.log('Backup Neo4j - finding nodes');

  if (query === 'server:exit') {
      // stop the node server
      driver.close();
      process.exit(0);
      return;
  }

  const session = driver.session();
  const startQuery = "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count";

  session
    .run(startQuery)
    .subscribe({
      onNext: function (record) {
        const obj={};
        for (let i=0; i< record.length; i++) {
          obj[record.keys[i]]=record._fields[i];
        }
        data.push(obj);
        console.log("%s/n",JSON.stringify(obj));
      },
      onCompleted: function () {
        // organize results into array
        for (let i = 0; i < data.length; i++) {
          nodesDone[i] = {};
          nodesDone[i].name = data[i].L;
          nodesDone[i].target = data[i].count.low;
        }
        fs.appendFile(`${finalPath}/nodeMetaData.txt`, JSON.stringify(nodesDone), (err) => {
          if (err) throw err;
        });

        response.end(JSON.stringify(nodesDone));
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
}

function findRels(query, response) {
  var data = [];
  var relsDone = [];

  console.log('Backup Neo4j - finding relations');

  if (query === 'server:exit') {
      // stop the node server
      driver.close();
      process.exit(0);
      return;
  }

  const session = driver.session();
  const startQuery = "MATCH (a)-[r]->(b) return distinct type(r) as type, count(r) as count order by type";

  session
    .run(startQuery)
    .subscribe({
      onNext: function (record) {
      const obj={};
    for (let i=0; i< record.length; i++) {
      obj[record.keys[i]]=record._fields[i];
      }
      data.push(obj);
        console.log("%s/n",JSON.stringify(obj));
      },
      onCompleted: function () {
        // organize results into array
        for (let i = 0; i < data.length; i++) {
          relsDone[i] = {};
          relsDone[i].name = data[i].type;
          relsDone[i].target = data[i].count.low;
        }
        fs.appendFile(`${finalPath}/relMetaData.txt`, JSON.stringify(relsDone), (err) => {
          if (err) throw err;
        });

        response.end(JSON.stringify(relsDone));
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
}

function backupNodes(query, response) {
  console.log('Backup Neo4j - backing up nodes');

  if (query === 'server:exit') {
      // stop the node server
      driver.close();
      process.exit(0);
      return;
  }

  const session = driver.session();

  let where = "";
  if (query.minimum > 0) {
    where = `where n.M_GUID > ${query.minimum}`;
  }

  const backupQuery = `match (n: ${query.name}) ${where} return n order by n.M_GUID limit ${query.blocksize}`;
  let data = [];

  session
    .run(backupQuery)
    .subscribe({
      onNext: function (record) {
        let currentObj = {};
        for (let i=0; i< record.length; i++) {
          currentObj[record.keys[i]]=record._fields[i];
        }
        delete currentObj.n.identity;
        data.push(currentObj);

        console.log("%s/n",JSON.stringify(currentObj));
      },
      onCompleted: function () {
        // store data
        fs.appendFile(`${finalPath}/nodes_${nodeFiles++}.txt`, JSON.stringify(data), (err) => {
          if (err) throw err;
        });

        // send progress back to client
        const lastID = data[data.length-1].n.properties.M_GUID.low;
        const update = {"numNodes":data.length, "lastID":lastID};
        response.end(JSON.stringify(update));
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
}

function backupRels(query, response) {
  console.log('Backup Neo4j - backing up relations');

  if (query === 'server:exit') {
      // stop the node server
      driver.close();
      process.exit(0);
      return;
  }

  const session = driver.session();

  let where = "";
  if (query.minimum > 0) {
    where = `where r.M_GUID > ${query.minimum}`;
  }
  const backupQuery = `match (a)-[r:${query.name}]->(b) ${where} return a.M_GUID as a, b.M_GUID as b, r order by r.M_GUID limit ${query.blocksize}`;
  let data = [];

  session
    .run(backupQuery)
    .subscribe({
      onNext: function (record) {
        let currentObj = {};
        for (let i=0; i< record.length; i++) {
          currentObj[record.keys[i]]=record._fields[i];
        }
        delete currentObj.r.identity;
        delete currentObj.r.start;
        delete currentObj.r.end;
        data.push(currentObj);
        console.log("%s/n",JSON.stringify(currentObj));
      },
      onCompleted: function () {
        // store data
        fs.appendFile(`${finalPath}/rels_${relFiles++}.txt`, JSON.stringify(data), (err) => {
          if (err) throw err;
        });

        // send progress back to client
        const lastID = data[data.length-1].r.properties.M_GUID.low;
        const update = {"numRels":data.length, "lastID":lastID};
        response.end(JSON.stringify(update));
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
}

//--------------------------------------Restore code---------------
let restoreFolder = "";
let restorePath = "";

function getNodeData(query, response) {
  restoreFolder = query.folder;
  restorePath = `${config.neo4jBackup}/${restoreFolder}`;
  const nodePath = `${restorePath}/nodeMetaData.txt`;

  fs.readFile(nodePath, function(err, data) {
    if (err) {
      console.log(err);
    }
    else {
      response.end(data);
    }
  });
}

function getRelData(query, response) {
  const relPath = `${restorePath}/relMetaData.txt`;
  fs.readFile(relPath, function(err, data) {
    if (err) {
      console.log(err);
    }
    else {
      response.end(data);
    }
  });
}

function restoreNodes(query, response) {
  const filePath = `${restorePath}/nodes_${nodeFiles++}.txt`;
  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, function(err, stringData) {
      if (err) {
        console.log(err);
      }
      else {
        const session = driver.session();

        let steps = "create ";
        data = JSON.parse(stringData);
        for (let i = 0; i < data.length; i++) { // for every node...
          const props = data[i].n.properties;
          let properties = "";
          for (let propName in props) { // loop through all properties and create text to set them...
            // If the property is an object with a low and high value, take the low one
            let value = props[propName];
            if (typeof value.low !== "undefined") {
              value = JSON.stringify(value.low);
            }
            else if (typeof value !== "string") {
              value = JSON.stringify(value);
            }
            properties += `${propName}: '${stringEscape(value)}', `;
          }
          if (properties.length > 0) {
            properties = properties.slice(0, properties.length - 2); // remove the last ", "
          }

          let nodeText = `(n${i}:${data[i].n.labels[0]} {${properties}}), `; // Crate text to make the node
          steps += nodeText; // add to the request
        } // end for (create command to restore each node)
        if (steps.length > 7) { // If at least one node needs to be added - which SHOULD always be the case
          steps = steps.slice(0, steps.length - 2);
          session
            .run(steps)
            .subscribe({ // I don't think we need to return the data we're creating
              // onNext: function (record) {
              //   const obj={};
              //   for (let i=0; i< record.length; i++) {
              //     obj[record.keys[i]]=record._fields[i];
              //   }
              //   data.push(obj);
              //   console.log("%s/n",JSON.stringify(obj));
              // },
              onCompleted: function () { // get the number and type of node restored and return it using response.end
                const obj = {};
                obj.numNodes = data.length;
                obj.name = data[0].n.labels[0]; // There should be at least one item and they should all have the same type
                response.end(JSON.stringify(obj));
                session.close();
              },
              onError: function (error) {
                console.log(error);
              }
            });

        } // end if (at least one node needs to be restored)
        else { // this should never happen - but may as well prepare for it
          alert ("Error: Tried to restore an empty set of nodes");
        }
      } // end else (file could be read)
    }); // end readFile call
  } // end if (file exists)
  else {
    response.end("Out of nodes");
  }
}

function restoreRels(query, response) {
  const filePath = `${restorePath}/rels_${relFiles++}.txt`;
  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, function(err, stringData) {
      if (err) {
        console.log(err);
      }
      else {
        const session = driver.session();

        data = JSON.parse(stringData);
        let nodeText = "";
        let relText = "";

        for (let i = 0; i < data.length; i++) { // for every relation...
          nodeText += `(a${i} {M_GUID:'${data[i].a.low}'}), (b${i} {M_GUID:'${data[i].b.low}'}), `

          const rProps = data[i].r.properties;
          let rProperties = "";
          for (let propName in rProps) { // loop through all properties of the relation and create text to set them...
            let value = rProps[propName];

            if (typeof value.low !== "undefined") {
              value = JSON.stringify(value.low);
            }
            else if (typeof value !== "string") {
              value = JSON.stringify(value);
            }
            rProperties += `${propName}: '${stringEscape(value)}', `;
          }
          if (rProperties.length > 0) {
            rProperties = rProperties.slice(0, rProperties.length - 2); // remove the last ", "
          }
          relText += `(a${i})-[r${i}:${data[i].r.type} {${rProperties}}]->(b${i}), `
        }
        if (nodeText.length > 0 && relText.length > 0) { // Assuming that at least one relation between two nodes was found
          nodeText = nodeText.slice(0, nodeText.length - 2);
          relText = relText.slice(0, relText.length - 2);
          let steps = `match ${nodeText} create ${relText}`;

          session
            .run(steps)
            .subscribe({ // I don't think we need to return the data we're creating
              // onNext: function (record) {
              //   const obj={};
              //   for (let i=0; i< record.length; i++) {
              //     obj[record.keys[i]]=record._fields[i];
              //   }
              //   data.push(obj);
              //   console.log("%s/n",JSON.stringify(obj));
              // },
              onCompleted: function () { // get the number and type of rel restored and return it using response.end
                const obj = {};
                obj.numRels = data.length;
                obj.name = data[0].r.type; // There should be at least one item and they should all have the same type
                response.end(JSON.stringify(obj));
                session.close();
              },
              onError: function (error) {
                console.log(error);
              }
            });
        }
        else { // this should never happen - but may as well prepare for it
          alert ("Error: Tried to upload an empty set of nodes");
        }
      } // end else (file could be read)
    }); // end readFile call
  } // end if (file exists)
  else {
    response.end("Out of rels");
  }
}

function stringEscape(text) {
  let string = JSON.stringify(text);
  string = string.substring(1, string.length-1);
  if (string.indexOf("'") > -1) {
    string = string.replace(/'/g, "\\'");
  }
  return string;
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
