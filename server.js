/*

small web server that serves static files and a
REST API into a database

*/


var http = require('http');
var fs   = require('fs');
var path = require('path');
var url  = require('url');
var uuidv1 = require('uuid/v1')

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
          case "CRUD":
            runCRUD(obj, response);
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

// test();

// test code goes here--------------------------
function test() {
  const obj = {a:"1", b:1};
  fs.writeFile('test.txt', JSON.stringify(obj), (err) => {
    if (err) throw err;
    else {
      fs.readFile('test.txt', (err, data) => {
        if (err) throw err;
        else {
          let newData = JSON.parse(data);
        }
      });
    }
  });
}

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

function runGremlin2(query, response) {
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
  if (query.functionName === "findNodes" || query.functionName === "startRestore") { // If starting a new process, reset variables
    nodeFiles = 1; // reset to defaults
    relFiles = 1;
  }

  if (query.functionName in backup) {
    backup[query.functionName](query, response);
  }
  else {
    console.log("Error: function '%s' is not a backup function\n", query.functionName);
  }
}
let backup = {};

backup.findNodes = function(query, response) {
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
      backup.finishFindNodes(query, response);
    }
  });
}

backup.finishFindNodes = function(query, response) {
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
        nodesDone.sort(function(a,b) {
          return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
        });
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

backup.findRels = function(query, response) {
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
        relsDone.sort(function(a,b) {
          return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
        });
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

backup.backupNodes = function(query, response) {
  console.log('Backup Neo4j - backing up nodes');

  if (query === 'server:exit') {
      // stop the node server
      driver.close();
      process.exit(0);
      return;
  }

  const session = driver.session();

  let where = "";
  if (query.minimum !== 0) {
    where = `where n.M_GUID > '${query.minimum}'`;
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
        // try to order the object
        const keys = Object.keys(currentObj.n.properties);
        keys.sort();
        const newObj = {};
        newObj.n = {};
        newObj.n.labels = currentObj.n.labels; // Leave everything except the individual properties the same
        newObj.n.properties = {};
        for (let i = 0; i < keys.length; i++) {
          newObj.n.properties[keys[i]] = currentObj.n.properties[keys[i]]; // Put properties back in alphabetical order
        }
        data.push(newObj);

        console.log("%s/n",JSON.stringify(newObj));
      },
      onCompleted: function () {
        // store data
        fs.appendFile(`${finalPath}/nodes_${nodeFiles++}.txt`, JSON.stringify(data), (err) => {
          if (err) throw err;
        });

        // send progress back to client
        const lastID = data[data.length-1].n.properties.M_GUID;
        const update = {"numNodes":data.length, "lastID":lastID};
        response.end(JSON.stringify(update));
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
}

backup.backupRels = function(query, response) {
  console.log('Backup Neo4j - backing up relations');

  if (query === 'server:exit') {
      // stop the node server
      driver.close();
      process.exit(0);
      return;
  }

  const session = driver.session();

  let where = "";
  if (query.minimum !== 0) {
    where = `where r.M_GUID > '${query.minimum}'`;
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

        // try to order the object
        const keys = Object.keys(currentObj.r.properties);
        keys.sort();
        const newObj = {};
        newObj.a = currentObj.a;
        newObj.b = currentObj.b;
        newObj.r = {};
        newObj.r.type = currentObj.r.type; // Leave everything except the individual properties the same
        newObj.r.properties = {};
        for (let i = 0; i < keys.length; i++) {
          newObj.r.properties[keys[i]] = currentObj.r.properties[keys[i]]; // Put properties back in alphabetical order
        }
        data.push(newObj);

        console.log("%s/n",JSON.stringify(newObj));
      },
      onCompleted: function () {
        // store data
        fs.appendFile(`${finalPath}/rels_${relFiles++}.txt`, JSON.stringify(data), (err) => {
          if (err) throw err;
        });

        // send progress back to client
        const lastID = data[data.length-1].r.properties.M_GUID;
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

backup.startRestore = function(query, response) {
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

backup.getRelData = function(query, response) {
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

backup.restoreNodes = function(query, response) {
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
            // If the property is an object with a low and high value (a number), take the low value
            let value = props[propName];
            if (typeof value.low !== "undefined") {
              value = value.low;
            }
            else if (typeof value === "string") { // if it's a string, string escape it and put it in quotes
              value = `"${stringEscape(value)}"`;
            }
            else { // if it's neither a number nor a string, stringify it
              value = `${JSON.stringify(value)}`;
            }
            properties += `${propName}: ${value}, `;
          }
          if (properties.length > 0) {
            properties = properties.slice(0, properties.length - 2); // remove the last ", "
          }

          let nodeText = `(n${i}:${data[i].n.labels[0]} {${properties}}), `; // Create text to make the node
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

backup.restoreRels = function(query, response) {
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
          nodeText += `(a${i} {M_GUID:'${data[i].a}'}), (b${i} {M_GUID:'${data[i].b}'}), `

          const rProps = data[i].r.properties;
          let rProperties = "";
          for (let propName in rProps) { // loop through all properties of the relation and create text to set them...
            let value = rProps[propName];

            if (typeof value.low !== "undefined") {
              value = value.low;
            }
            else if (typeof value === "string") { // if it's a string, string escape it and put it in quotes
              value = `"${stringEscape(value)}"`;
            }
            else { // if it's neither a number nor a string, stringify it
              value = `${JSON.stringify(value)}`;
            }

            // if (typeof value.low !== "undefined") {
            //   value = JSON.stringify(value.low);
            // }
            // else if (typeof value !== "string") {
            //   value = JSON.stringify(value);
            // }
            rProperties += `${propName}: ${value}, `;
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

//--------------------CRUD functions-----------------------------------------
function runCRUD(obj, response) {
  if (obj.function in CRUD) {
    CRUD[obj.function](obj, response);
  }
  else {
    console.log(`Error: ${obj.function} is not a CRUD function.`);
  }
}

let CRUD = {};

CRUD.createNode = function(obj, response) {
  let dataObj = obj.query;
  const strings = {ret:"", where:""}; // where won't be used here, but I'm including it for consistency
  const node = buildSearchString(dataObj, strings, "where", "node");

  let command = "create";
  let oncreate = `set node.M_GUID = '${uuidv1()}'`;
  if (dataObj.merge === true) {
    command = "merge";
    oncreate = `on create set node.M_GUID = '${uuidv1()}'`;
  }

  // return the node's GUID to compare it to the one that it would have been assigned
  // (needed to tell whether a merge resulted in creation)
  if (strings.ret === "") {
    strings.ret = "return node.M_GUID as GUID"
  }
  else {
    strings.ret = `return ${strings.ret}, node.M_GUID as GUID`;
  }

  const query = `${command} (${node}) ${oncreate} ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.deleteNode = function(obj, response) {
  let dataObj = obj.query;
  const strings = {ret:"", where:""};
  const node = buildSearchString(dataObj, strings, "where", "node");

  const query = `match (${node}) detach delete node`;
  sendQuery(query, response);
}

CRUD.changeNode = function(obj, response) {
  let dataObj = obj.query;
  const strings = {ret:"", where:""};
  // Build the string representing the node - what goes in the parentheses
  const node = buildSearchString(dataObj.node, strings, "where", "node");

  // Build the string representing the changes - what comes after the SET keyword
  // dataObj.changes should be an array, each entry in which includes a property, a value and possibly a string boolean
  let changes ="";
  if (dataObj.changes) { // Think about how to combine this with buildChangesString later - only difference is no "item" entry
    for (let i = 0; i < dataObj.changes.length; i++) {
      let value = `"${dataObj.changes[i].value}"`;
      if (dataObj.changes[i].string === false) { // default is that the new value is a string, but can be overridden
        value = `${dataObj.changes[i].value}`;
      }

      if (changes == "") {
        changes = `set node.${dataObj.changes[i].property} = ${value}`;
      }
      else changes += `, node.${dataObj.changes[i].property} = ${value}`;
    }
  }

  if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  let command = 'match';
  let oncreate = "";
  if (dataObj.merge === true) {
    command = 'merge';
    oncreate = `on create set node.M_GUID = '${uuidv1()}'`;
  }

  const query = `${command} (${node}) ${strings.where} ${oncreate} ${changes} ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.createRelation = function(obj, response) {
  let dataObj = obj.query;
  const strings = {ret:"", where:""};

  // Build the string representing the "from" node - what goes in the first set of parentheses
  let from = "";
  if (dataObj.from) {
    from = buildSearchString(dataObj.from, strings, "where", "from");
  }
  else {
    from = buildSearchString({}, strings, "where", "from");
  }

  // Build the string representing the "to" node - what goes in the second set of parentheses
  let to = "";
  if (dataObj.to) {
    to = buildSearchString(dataObj.to, strings, "where", "to");
  }
  else {
    to = buildSearchString({}, strings, "where", "to");
  }

  // Build the string representing the relation - what goes in the brackets
  let rel = "";
  if (dataObj.rel) {
    rel = buildSearchString(dataObj.rel, strings, "where", "rel");
  }
  else {
    rel = buildSearchString({}, strings, "where", "rel");
  }

  let command = "create";
  let oncreate = `set rel.M_GUID = '${uuidv1()}'`;

  if (dataObj.rel && dataObj.rel.merge === true) {
    command = "merge";
    oncreate = `on create set rel.M_GUID = '${uuidv1()}'`;
  }

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  const query = `match (${from}), (${to}) ${strings.where} ${command} (from)-[${rel}]->(to) ${oncreate} ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.deleteRelation = function(obj, response) {
  let dataObj = obj.query;
  // These strings are stored in an object so they can be passed in and out of methods and updated
  const strings = {ret:"", where:""};

  // Build the string representing the "from" node - what goes in the first set of parentheses
  let from = "";
  if (dataObj.from) {
    from = buildSearchString(dataObj.from, strings, "where", "from");
  }
  else {
    from = buildSearchString({}, strings, "where", "from");
  }

  // Build the string representing the "to" node - what goes in the second set of parentheses
  let to = "";
  if (dataObj.to) {
    to = buildSearchString(dataObj.to, strings, "where", "to");
  }
  else {
    to = buildSearchString({}, strings, "where", "to");
  }

  // Build the string representing the relation - what goes in the brackets
  let rel = "";
  if (dataObj.rel) {
    rel = buildSearchString(dataObj.rel, strings, "where", "rel");
  }
  else {
    rel = buildSearchString({}, strings, "where", "rel");
  }

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  const query = `match (${from})-[${rel}]->(${to}) ${strings.where} delete rel ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.changeRelation = function(obj, response) {
  let dataObj = obj.query;
  // These strings are stored in an object so they can be passed in and out of methods and updated
  const strings = {ret:"", nodesWhere:"", relWhere:""};

  // Build the string representing the "from" node - what goes in the first set of parentheses
  let from = "";
  if (dataObj.from) {
    from = buildSearchString(dataObj.from, strings, "nodesWhere", "from");
  }
  else {
    from = buildSearchString({}, strings, "nodesWhere", "from");
  }

  // Build the string representing the "to" node - what goes in the second set of parentheses
  let to = "";
  if (dataObj.to) {
    to = buildSearchString(dataObj.to, strings, "nodesWhere", "to");
  }
  else {
    to = buildSearchString({}, strings, "nodesWhere", "to");
  }

  // Build the string representing the relation - what goes in the brackets
  let rel = "";
  if (dataObj.rel) {
    rel = buildSearchString(dataObj.rel, strings, "relWhere", "rel");
  }
  else {
    rel = buildSearchString({}, strings, "relWhere", "rel");
  }

  // Build the string representing the changes - what comes after the SET keyword
  let changes = "";
  if (dataObj.changes) {
   changes = buildChangesString(dataObj.changes);
  }

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  let command = 'match';
  let oncreate = "";

  if (dataObj.rel.merge === true) {
    command = 'merge';
    oncreate = `on create set rel.M_GUID = '${uuidv1()}'`;
  }

  const query = `match (${from}), (${to}) ${strings.nodesWhere} ${command} (from)-[${rel}]->(to) ${strings.relWhere} ${oncreate} ${changes} ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.findOptionalRelation = function(obj, response) {
  let dataObj = obj.query;
  // These strings are stored in an object so they can be passed in and out of methods and updated
  // Need TWO where clauses - one for the required node, one for the optional node and relation
  const strings = {ret:"", reqWhere:"", optWhere:""};

  // Build the string representing the "from" node - what goes in the first set of parentheses
  let required = "";
  if (dataObj.required) {
    required = buildSearchString(dataObj.required, strings, "reqWhere", "required");
  }
  else {
    required = buildSearchString({}, strings, "reqWhere", "required");
  }

  // Build the string representing the "to" node - what goes in the second set of parentheses
  let optional = "";
  if (dataObj.optional) {
    optional = buildSearchString(dataObj.optional, strings, "optWhere", "optional");
  }
  else {
    optional = buildSearchString({}, strings, "optWhere", "optional");
  }

  // Build the string representing the relation - what goes in the brackets
  let rel = "";
  if (dataObj.rel) {
    rel = buildSearchString(dataObj.rel, strings, "optWhere", "rel");
  }
  else {
    rel = buildSearchString({}, strings, "optWhere", "rel");
  }

  // Build the string representing the changes - what comes after the SET keyword
  let changes = "";
  if (dataObj.changes) {
   changes = buildChangesString(dataObj.changes);
  }

  // default is that the relation starts on the required node, but if the direction is specified, it can go backward
  let arrow = `-[${rel}]->`;
  if (dataObj.rel && dataObj.rel.direction && dataObj.rel.direction == "left") {
    arrow = `<-[${rel}]-`;
  }

  strings.ret = `return ${strings.ret}`;

  const query = `match (${required}) ${strings.reqWhere}
                 optional match (required)${arrow}(${optional}) ${strings.optWhere} ${changes} ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.changeTwoRelPattern = function(obj, response) {
  let dataObj = obj.query;
  const strings = {ret:"", where:""};

  // Build the string representing the "start" node - what goes in the first set of parentheses
  let start = "";
  if (dataObj.start) {
    start = buildSearchString(dataObj.start, strings, "where", "start");
  }
  else {
    start = buildSearchString({}, strings, "where", "start");
  }

  // Build the string representing the "middle" node - what goes in the second set of parentheses
  let middle = "";
  if (dataObj.middle) {
    middle = buildSearchString(dataObj.middle, strings, "where", "middle");
  }
  else {
    middle = buildSearchString({}, strings, "where", "middle");
  }

  // Build the string representing the "end" node - what goes in the third set of parentheses
  let end = "";
  if (dataObj.end) {
    end = buildSearchString(dataObj.end, strings, "where", "end");
  }
  else {
    end = buildSearchString({}, strings, "where", "end");
  }

  // Build the string representing the first relation - what goes in the first set of brackets
  let rel1 = "";
  if (dataObj.rel1) {
    rel1 = buildSearchString(dataObj.rel1, strings, "where", "rel1");
  }
  else {
    rel1 = buildSearchString({}, strings, "where", "rel1");
  }

  // Build the string representing the second relation - what goes in the second set of brackets
  let rel2 = "";
  if (dataObj.rel2) {
    rel2 = buildSearchString(dataObj.rel2, strings, "where", "rel2");
  }
  else {
    rel2 = buildSearchString({}, strings, "where", "rel2");
  }

  // Build the string representing the changes - what comes after the SET keyword
  let changes = "";
  if (dataObj.changes) {
   changes = buildChangesString(dataObj.changes);
  }

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  const query = `match (${start})-[${rel1}]->(${middle})-[${rel2}]->(${end}) ${strings.where} ${changes} ${strings.ret}`;
  sendQuery(query, response);
}

CRUD.tableNodeSearch = function(obj, response) {
  let dataObj = obj.query;
  let ID = obj.ID;

  // Example search string:
  // match (n:type) where n.numField < value and n.stringField =~(?i)value
  // optional match (n)-[:Permissions]->(perm:M_LoginTable) return n, perm.name as permissions
  // order by first, second, third limit 9

  // Notes: use *. for wildcard in string search. Only search for permissions if type = people.
  // Regexes apparently have to be in a where clause, not in curly braces, so for simplicity, put all criteria in where clause.

  // Build the where clause, starting with requirement that current user has not trashed this node
  let where = `where ID(a)=${ID} and not (a)-[:Trash]->(${dataObj.name}) and `;

  for (let field in dataObj.where) {
    if (dataObj.where[field].fieldType == "string") {
      // =~: regex; (?i): case insensitive; #s# and #E#: placeholders for start and end variables
      // (start and end variables can be ".*", meaning "any string", or "", meaning "nothing")
      const w = `${dataObj.name}.${field}=~"(?i)#s#${dataObj.where[field].value}#E#" and `;
      let w1="";
      switch(dataObj.where[field].searchType) {
        case "S":    // start
          // Anything can come AFTER the specified value, but nothing BEFORE it (it starts the desired string)
          w1 = w.replace('#s#',"").replace('#E#','.*');    break;
        case "M":    // middle
          // Anything can come before or after the specified value (as long as it appears anywhere in the string)
          w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
        case "E":    // end
          // Anything can come BEFORE the specified value, but nothing AFTER it (it ends the desired string)
          w1 = w.replace('#s#',".*").replace('#E#','');    break;
        case "=":    // equal to
          // NOTHING can come before OR after the specified value (string must match it exactly)
          w1 = w.replace('#s#',"").replace('#E#','');      break;
        default:
          console.log("Error: search type for a string field is not 'S', 'M', 'E' or '='.");
      }
      where += w1;
    }
    else { // number field
      where += `${dataObj.name}.${field} ${dataObj.where[field].searchType} ${dataObj.where[field].value} and `;
    }
  }

  if (dataObj.owner) {
    const w = `o.name=~"(?i)#s#${dataObj.owner.value}#E#" and `;
    let w1="";
    switch(dataObj.owner.searchType) {
      case "S":    // start
        // Anything can come AFTER the specified value, but nothing BEFORE it (it starts the desired string)
        w1 = w.replace('#s#',"").replace('#E#','.*');    break;
      case "M":    // middle
        // Anything can come before or after the specified value (as long as it appears anywhere in the string)
        w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
      case "E":    // end
        // Anything can come BEFORE the specified value, but nothing AFTER it (it ends the desired string)
        w1 = w.replace('#s#',".*").replace('#E#','');    break;
      case "=":    // equal to
        // NOTHING can come before OR after the specified value (string must match it exactly)
        w1 = w.replace('#s#',"").replace('#E#','');      break;
      default:
        console.log("Error: search type for a string field is not 'S', 'M', 'E' or '='.");
    }
    where += w1;
  }

  if (dataObj.permissions) {
    switch (dataObj.permissions) {
      case "users":
        where += `t.name = 'User' and `;
        break;
      case "admins":
        where += `t.name = 'Admin' and `;
        break;
      case "allUsers": // These do nothing - they're only here so that a REAL default can produce an error message
      case "all":
        break;
      default:
        console.log("Error: Search type for permissions is not users, admins, users and admins, or all people");
    }
  }

  // Remove the last " and " from the where clause
  where = where.slice(0, -5);

  let permCheck = "";
  let ret = `return ${dataObj.name}`;
  if (dataObj.type == "people") {
    permCheck = `optional match (${dataObj.name})-[:Permissions]->(perm:M_LoginTable)`;
    ret += `, perm.name as permissions`;
  }

  let ownerCheck = "";
  if (dataObj.type == "mindmap") {
    ownerCheck = `optional match (${dataObj.name})-[:Owner]->(owner:people)`;
    ret += `, owner.name as owner`;
  }

  let query = `match (${dataObj.name}:${dataObj.type})`;

  if (dataObj.owner) {
    query += `-[:Owner]->(o:people)`;
  }

  if (dataObj.permissions && dataObj.permissions != "all") {
    query += `-[:Permissions]->(t:M_LoginTable)`; // require a permissions link
  }

  let orderBy = "";
  for (let i = 0; i < dataObj.orderBy.length; i++) {
    orderBy += `n.${dataObj.orderBy[i]}, `;
  }

  // Remove the last ', '
  orderBy = orderBy.slice(0, -2);

  query += `, (a) ${where} ${permCheck} ${ownerCheck}
                 ${ret} order by ${orderBy} limit ${dataObj.limit}`;
  sendQuery(query, response);
}

CRUD.addNodeToView = function(obj, response) {
  let dataObj = obj.query;
  let ID = obj.ID;
  let attributeString = "";
  for (let attribute in dataObj.attributes) {
    attributeString += `${attribute}: "${dataObj.attributes[attribute]}", `;
  }
  
  // if any attributes were found, the string needs to have the last ", " removed, and it needs to be enclosed in curly braces.
  if (attributeString.length > 0) {
    attributeString = ` {${attributeString.slice(0, -2)}}`;
  }

  const query = `match (per), (start), (end)
               where ID(per) = ${ID} and ID(start) = ${dataObj.startID} and ID(end)=${dataObj.endID}
               merge (per)-[r1:Owner]->(view:M_View {direction:"start"})-[r2:Subject]->(start) on create set r1.M_GUID = '${uuidv1()}', view.M_GUID = '${uuidv1()}', r2.M_GUID = '${uuidv1()}'
               merge (view)-[endLink:Link${attributeString}]->(end) on create set endLink.M_GUID = '${uuidv1()}'
               merge (per)-[r3:Owner]->(view2:M_View {direction:"end"})-[r4:Subject]->(end) on create set r3.M_GUID = '${uuidv1()}', view2.M_GUID = '${uuidv1()}', r4.M_GUID = '${uuidv1()}'
               merge (view2)-[startLink:Link${attributeString}]->(start) on create set startLink.M_GUID = '${uuidv1()}'
               return ${dataObj.relation} as link`;
  sendQuery(query, response);
}

CRUD.getMetaData = function(obj, response) {
  let queryName = obj.query;
  let ID = obj.ID;

  const metadataQueries = {
    nodes: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
    ,keysNode: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p) as label,  count(key) as count  order by key"
    ,relations: "MATCH (a)-[r]->(b) return distinct labels(a), type(r), labels(b), count(r) as count  order by type(r)"
    ,keysRelation: "match ()-[r]->() unwind keys(r) as key return distinct key, type(r), count(key) as count"
    ,myTrash: `match (user)-[rel:Trash]->(node) where ID(user)=${ID} return id(node) as id, node.name as name, labels(node) as labels, rel.reason as reason, node`
    ,allTrash: `match ()-[rel:Trash]->(node) return ID(node) as id, node.name as name, count(rel) as count`
  }

  sendQuery(metadataQueries[queryName], response);
}

function buildSearchString(obj, strings, whereString, defaultName) {
  let string = defaultName;

  if (!(obj.return && obj.return === false)) { // This should usually be undefined if it's not false, but users might also set it to true
    if (strings.ret == "") {
      strings.ret = `${defaultName}`;
    }
    else strings.ret += `, ${defaultName}`;

    if (obj.name) {
      strings.ret += ` as ${obj.name}`;
    }
  }

  if (obj.type) {
    string += `:${obj.type}`;
  }

  if (obj.properties) {
    let props = "";
    for (let prop in obj.properties) {
      if (props == "") {
        props = `${prop}: "${obj.properties[prop]}"`;
      }
      else props += `, ${prop}: "${obj.properties[prop]}"`;
    }
    string += `{${props}}`;
  }

  if (obj.id && whereString) {
    if (strings[whereString] == "") {
      strings[whereString] = `where ID(${defaultName}) = ${obj.id}`;
    }
    else strings[whereString] += ` and ID(${defaultName}) = ${obj.id}`;
  }

  return string;
}

function buildChangesString(changeArray) {
  let changes = "";
  for (let i = 0; i < changeArray.length; i++) {
    let value = `"${changeArray[i].value}"`;
    if (changeArray[i].string === false) { // default is that the new value is a string, but can be overridden
      value = `${changeArray[i].value}`;
    }

    if (changes == "") {
      changes = `set ${changeArray[i].item}.${changeArray[i].property} = ${value}`;
    }
    else changes += `,${changeArray[i].item}.${changeArray[i].property} = ${value}`;
  }
  return changes;
}

function sendQuery(query, response) {
  const session = driver.session();
  var result = [];

  session
    .run(query)
    .subscribe({
      onNext: function (record) {
      const obj={};
      for (let i=0; i< record.length; i++) {
        obj[record.keys[i]]=record._fields[i];
      }
      result.push(obj);
        console.log("%s/n",JSON.stringify(obj));
      },
      onCompleted: function () {
        // Results should be an array of row objects. Each row object will contain one object per item to return.
        // Each of THOSE may contain integer objects with a "high" and "low" value, which should be converted to a simple number.
        // Identity variables, specifically, should be rewritten as "id" for ease of typing later.
        // (NOTE: Consider removing the id variable entirely - it's unreliable in Neo4j and may be very different in other DBs.)
        // Also, row objects from metadata queries may include an id or count variable, which should also be rewritten.
        for (let i = 0; i < result.length; i++) { // For every row, start by simplifying the count and ID if they exist...
          const row = result[i];
          if (row.count) {
            row.count = row.count.low;
          }
          if (row.id) {
            row.id = row.id.low;
          }

          for (let item in row) { // for every item in the row, replace the identity if it exists
            const entry = row[item];
            if (entry && entry.identity && entry.identity.low) {
              const IDobj = entry.identity;
              const ID = IDobj.low;
              entry.id = ID;
              delete entry.identity;
            }

            if (entry && entry.properties) { // If the item has properties...
              for (let property in entry.properties) { // then for every property...
                const value = entry.properties[property];
                // This is the best set of criteria I can see to recognize an Integer object without using Neo4j functions:
                // It has exactly two own properties (high and low), "high" is 0 and "low" is an integer.
                // NOTE: I have since learned that very large integers can have a value in "high" as well.
                // I don't see it coming up often, and if it does, we'll probably need to leave the Integer alone anyway.
                if (typeof value === "object" && Object.keys(value).length == 2 // if the property is an Integer with no high value...
                    && "low" in value && Number.isInteger(value.low) && "high" in value && value.high === 0) {
                  entry.properties[property] = value.low; // simplify it.
                } // end if (value is a Neo4j integer)
              } // end for (every property in the item)
            } // end if (the item has properties)
          } // end for (every item in the row)
        } // end for (every row)
        response.end(JSON.stringify(result));
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
    });
  }


//--------------Helper functions---------------------------------------------

function stringEscape(text) {
  let string = JSON.stringify(text);
  string = string.substring(1, string.length-1);
  // if (string.indexOf("'") > -1) {
  //   string = string.replace(/'/g, "\\'");
  // }
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
