/*

small web server that serves static files and a
REST API into a database

*/


var http = require('http');
var fs   = require('fs');
var path = require('path');
var url  = require('url');
var uuidv1 = require('uuid/v1')
const config  = require('./config');


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

}).listen(config.port);

console.log(`Server running at http://127.0.0.1:${config.port}`);

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

let changeCount = 0;

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
        console.log(`${nodes.length} node types found.`);
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
        getChangeCount();
        session.close();
      },
      onError: function (error) {
        console.log(error);
      }
  });
}

function getChangeCount() {
  const session = driver.session();
  let query = `match (n:M_ChangeLog) return coalesce(max(n.number), 0) as max`;
  session
    .run(query)
    .subscribe({
      onNext: function (record) {
        changeCount = record._fields[0];
      },
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
  let number = ++changeCount;
  const uuid = uuidv1();

  const strings = {ret:"", where:""}; // where won't be used here, but I'm including it for consistency
  const changeLogData = {"userGUID":obj.GUID, "itemGUID":uuid, "changeLogs":""}
  const node = buildSearchString(dataObj, strings, "where", "node", changeLogData);

  if (strings.ret !== "") {
    strings.ret = `return ${strings.ret}`;
  }

  const changeUUID = uuidv1();
  let changeLogs = `(change0:M_ChangeLog {number:${number}, item_GUID:'${uuid}', user_GUID:'${obj.GUID}',
                     action:'create', label:'${dataObj.type}', M_GUID:'${changeUUID}'}), ${changeLogData.changeLogs}`;
  changeLogs = changeLogs.slice(0,changeLogs.length-2); // remove the last ", "

  const query = `create (${node}), ${changeLogs} set node.M_GUID = '${uuid}' ${strings.ret}`;

  console.log(query);
  sendQuery(query, response);
}

CRUD.deleteNode = function(obj, response) {
  let dataObj = obj.query;

  const strings = {ret:"", where:""};
  const node = buildSearchString(dataObj, strings, "where", "node");

  const query = `match (${node}) with node, node.M_GUID as id detach delete node
                 create (c:M_ChangeLog {number:${++changeCount}, action:'delete', item_GUID:id, user_GUID:'${obj.GUID}'})`;
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
  let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
  if (dataObj.changes) {
    changes = buildChangesString(dataObj.changes, changeLogData);
  }

  let changeLogs = "";
  if (changeLogData.changeLogs.length > 0) {
    changeLogs = `with node create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
  }

  if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  let orderBy = "";
  if (dataObj.order) {
    orderBy = buildOrderString(dataObj.order, "node");
  }

  if (dataObj.node.merge === true) {
    const session = driver.session();
    var result = [];

    const query = `match (${node}) ${strings.where} return node`; // search for the node and return it; make no changes
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
          if (result.length > 0) { // if the node was found, make any changes and return it
            const query2 = `match (${node}) ${strings.where} ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
            sendQuery(query2, response);
            session.close();
          }

          // if the node was not found, move any changes into the node.properties object and pass the node object it to createNode.
          else {
            if (!(dataObj.node.properties)) {
              dataObj.node.properties = {};
            }

            // the changes array in this case will include "property" and "value"
            if (obj.changes) {
              for (let i = 0; i < obj.changes.length; i++) {
                dataObj.node.properties[obj.changes[i].property] = obj.changes[i].value;
              }
            }

            const query2 = {"query":dataObj.node, "GUID":obj.GUID};
            CRUD.createNode(query2, response);
            session.close();
          }
        },
        onError: function (error) {
          console.log(error);
        }
      });
  } // end if (merging)

  else {
    const query = `match (${node}) ${strings.where} ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
    sendQuery(query, response);
  }
}

CRUD.createRelation = function(obj, response) {
  let dataObj = obj.query;
  let number = ++changeCount;
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

  // Build the string representing the relation - what goes in the brackets. This gets created, not found,
  // so include changeLog data to record setting each attribute.
  let uuid = uuidv1();
  const changeLogData = {"userGUID":obj.GUID, "itemGUID":uuid, "changeLogs":""}

  let rel = "";
  if (dataObj.rel) {
    rel = buildSearchString(dataObj.rel, strings, "where", "rel", changeLogData);
  }
  else {
    rel = buildSearchString({}, strings, "where", "rel"); // if there's no rel object, there are no attributes to set - no need for changeLogData
  }

  // finish the string to generate changeLogs
  const changeUUID = uuidv1();
  let changeLogs = `(change0:M_ChangeLog {number:${number}, item_GUID:'${uuid}', user_GUID:'${obj.GUID}',
                     to_GUID:to.M_GUID, from_GUID:from.M_GUID, label:'${dataObj.rel.type}',
                     action:'create', M_GUID:'${changeUUID}'}), ${changeLogData.changeLogs}`;
  changeLogs = changeLogs.slice(0,changeLogs.length-2); // remove the last ", "

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  const query = `match (${from}), (${to}) ${strings.where}
                 create (from)-[${rel}]->(to), ${changeLogs} set rel.M_GUID = '${uuid}' ${strings.ret}`;
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

  const query = `match (${from})-[${rel}]->(${to}) ${strings.where} with to, from, rel, rel.M_GUID as id
                 delete rel create (c:M_ChangeLog {number:${++changeCount}, action:'delete', item_GUID:id, user_GUID:'${obj.GUID}'})
                 ${strings.ret}`;
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
  // dataObj.changes should be an array, each entry in which includes an item, a property, a value and possibly a string boolean
  let changes ="";
  let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
  if (dataObj.changes) {
    changes = buildChangesString(dataObj.changes, changeLogData);
  }

  let changeLogs = "";
  if (changeLogData.changeLogs.length > 0) {
    changeLogs = `with from, rel, to create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
  }

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  let orderBy = "";
  if (dataObj.order) {
    orderBy = buildOrderString(dataObj.order);
  }

  // Simulate merging without using the MERGE keyword
  if (dataObj.rel.merge === true) {
    const session = driver.session();
    var result = [];

    // start by trying to match the whole pattern, as if not merging, but don't make any changes yet
    const query = `match (${from}), (${to}) ${strings.nodesWhere}
                   match (from)-[${rel}]->(to) ${strings.relWhere}
                   return rel`;

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
          // if the pattern was found, remove the merge flag (since no creation is needed) and call changeRelation again
          if (result.length > 0) {
            dataObj.rel.merge = false;
            CRUD.changeRelation(obj,response); // obj contains dataObj and should be updated as dataObj changes
          }
          else { // if the pattern was not found, look for the nodes. Passing in the search strings will make it easier.
            findNodesForMerge(from, to, strings.nodesWhere, obj, response);
          }
        },
        onError: function (error) {
          console.log(error);
        }
      });
  } // end if (merging)

  else {
    const query = `match (${from}), (${to}) ${strings.nodesWhere} match (from)-[${rel}]->(to) ${strings.relWhere} ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
    sendQuery(query, response);
  }
}

CRUD.findOptionalRelation = function(obj, response) {
  let dataObj = obj.query;
  // These strings are stored in an object so they can be passed in and out of methods and updated
  // Need TWO where clauses - one for the required node, one for the optional node and relation
  const strings = {ret:"", reqWhere:"", optWhere:""};

  // Build the string representing the "required" node - what goes in the first set of parentheses
  let required = "";
  if (dataObj.required) {
    required = buildSearchString(dataObj.required, strings, "reqWhere", "required");
  }
  else {
    required = buildSearchString({}, strings, "reqWhere", "required");
  }

  // Build the string representing the "optional" node - what goes in the second set of parentheses
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
  // dataObj.changes should be an array, each entry in which includes an item, a property, a value and possibly a string boolean
  let changes ="";
  let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
  if (dataObj.changes) {
    changes = buildChangesString(dataObj.changes, changeLogData);
  }

  let changeLogs = "";
  if (changeLogData.changeLogs.length > 0) {
    changeLogs = `with required, rel, optional create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
  }

  // default is that the relation starts on the required node, but if the direction is specified, it can go backward
  let arrow = `-[${rel}]->`;
  if (dataObj.rel && dataObj.rel.direction && dataObj.rel.direction == "left") {
    arrow = `<-[${rel}]-`;
  }

  let orderBy = "";
  if (dataObj.order) {
    orderBy = buildOrderString(dataObj.order);
  }

  if (strings.ret.length > 0) {
    strings.ret = `return ${strings.ret}`;
  }

  const query = `match (${required}) ${strings.reqWhere}
                 optional match (required)${arrow}(${optional}) ${strings.optWhere}
                 ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
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
  // dataObj.changes should be an array, each entry in which includes an item, a property, a value and possibly a string boolean
  let changes ="";
  let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
  if (dataObj.changes) {
    changes = buildChangesString(dataObj.changes, changeLogData);
  }

  let changeLogs = "";
  if (changeLogData.changeLogs.length > 0) {
    changeLogs = `with start, middle, end, rel1, rel2 create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
  }

  if (strings.ret != "" && dataObj.distinct) {
    strings.ret = `return distinct ${strings.ret}`;
  }
  else if (strings.ret != "") {
    strings.ret = `return ${strings.ret}`;
  }

  let orderBy = "";
  if (dataObj.order) {
    orderBy = buildOrderString(dataObj.order);
  }

  const query = `match (${start})-[${rel1}]->(${middle})-[${rel2}]->(${end}) ${strings.where}
                 ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
  sendQuery(query, response);
}

CRUD.tableNodeSearch = function(obj, response) {
  let dataObj = obj.query;
  let GUID = obj.GUID;

  // Example search string:
  // match (n:type) where n.numField < value and n.stringField =~(?i)value
  // optional match (n)-[:Permissions]->(perm:M_LoginTable) return n, perm.name as permissions
  // order by first, second desc, third limit 9

  // Notes: use *. for wildcard in string search. Only search for permissions if type = people.
  // Regexes apparently have to be in a where clause, not in curly braces, so for simplicity, put all criteria in where clause.

  // Build the where clause, starting with requirement that current user has not trashed this node
  let where = `where a.M_GUID='${GUID}' and not (a)-[:Trash]->(${dataObj.name}) and `;

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

  let orderBy = buildOrderString(dataObj.orderBy, "n");

  query += `, (a) ${where} ${permCheck} ${ownerCheck}
                 ${ret} ${orderBy} limit ${dataObj.limit}`;
  sendQuery(query, response);
}

CRUD.getMetaData = function(obj, response) {
  let queryName = obj.query;
  let GUID = obj.GUID;

  const metadataQueries = {
    nodes: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
    ,keysNode: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p) as label,  count(key) as count  order by key"
    ,relations: "MATCH (a)-[r]->(b) return distinct labels(a), type(r), labels(b), count(r) as count  order by type(r)"
    ,keysRelation: "match ()-[r]->() unwind keys(r) as key return distinct key, type(r), count(key) as count"
    ,myTrash: `match (user)-[rel:Trash]->(node) where user.M_GUID = '${GUID}' return node.name as name, node.M_GUID as GUID, labels(node) as labels, rel.reason as reason, node`
    ,allTrash: `match ()-[rel:Trash]->(node) return node.M_GUID as GUID, node.name as name, count(rel) as count`
  }

  sendQuery(metadataQueries[queryName], response);
}

// changeLogData includes: userGUID, itemGUID, changeLogs
function buildSearchString(obj, strings, whereString, defaultName, changeLogData) {
  let string = defaultName;

  if (obj.return !== false) { // This should usually be undefined if it's not false, but users might also set it to true
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

  if (obj.properties) { // If any properties were specified...
    let props = "";
    for (let prop in obj.properties) { // go through all of them...
      // add to the changeLog string if necessary...
      if (changeLogData) {
        changeLogData.changeLogs += `(change${changeCount++}:M_ChangeLog {number:${changeCount},
                                     item_GUID:'${changeLogData.itemGUID}', user_GUID:'${changeLogData.userGUID}',
                                     action:'change', attribute:'${prop}', value:'${obj.properties[prop]}', M_GUID:'${uuidv1()}'}), `;
      }
      if (props == "") { // and add each one to the props string.
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

// changeLogData includes: userGUID, changeLogs
function buildChangesString(changeArray, changeLogData) {
  let changes = "";
  let item = "node"; // default, for changeNode
  for (let i = 0; i < changeArray.length; i++) { // go through all changes...

    let value = `"${changeArray[i].value}"`; // set the value of the attribute...
    if (changeArray[i].string === false) { // default is that the new value is a string, but can be overridden
      value = `${changeArray[i].value}`;
    }
    if (changeArray[i].item) {
      item = changeArray[i].item;
    }

    // add to the changeLog string
    changeLogData.changeLogs += `(change${changeCount++}:M_ChangeLog {number:${changeCount},
                                 item_GUID:${item}.M_GUID, user_GUID:'${changeLogData.userGUID}', M_GUID:'${uuidv1()}',
                                 action:'change', attribute:'${changeArray[i].property}', value:'${value}'}), `;

    if (changes == "") {
      changes = `set ${item}.${changeArray[i].property} = ${value}`; // add to the string that implements changes
    }
    else changes += `,${item}.${changeArray[i].property} = ${value}`;
  }
  return changes;
}

// orderArray: Array of objects containing item (except for changeNode), name and direction ("A" or "D", but "A" is default and doesn't need to be specified)
function buildOrderString(orderArray, defaultName) {
  let order = "order by ";
  let item = defaultName; // name to use if no item is specified
  for (let i = 0; i < orderArray.length; i++) {
    let o = orderArray[i];
    if (o.item) {
      item = o.item;
    }
    let dir = "";
    if (o.direction == "D") {
      dir = " desc";
    }
    order += `${item}.${o.name}${dir}, `;
  }
  return order.slice(0, order.length-2); // Remove the last ", " and return
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

function findNodesForMerge(from, to, where, obj, response) {
  // search for the nodes that the relation should be merged between. Make any changes to the nodes. Return them (just to prove something was there).
  const dataObj = obj.query;
  const nodeChanges = [];

  if (dataObj.changes) { // If any changes were requested...
    if (!dataObj.rel.properties) {
      dataObj.rel.properties = {}; // make sure there is a properties object...
    }

    for (let i = 0; i < dataObj.changes.length; i++) {
      if (dataObj.changes[i].item === "rel") { // move relation changes into properties object...
        dataObj.rel.properties[dataObj.changes[i].property] = dataObj.changes[i].value;
      }
      else { // and get ready to make changes to the nodes.
        nodeChanges.push(dataObj.changes[i]);
      }
    }
  }

  // build the string to make changes and the strings to create changeLogs
  let changes ="";
  let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
  if (nodeChanges.length > 0) {
   changes = buildChangesString(nodeChanges, changeLogData);
  }

  let changeLogs = "";
  if (changeLogData.changeLogs.length > 0) {
    changeLogs = `with from, to create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
  }

  const query = `match (${from}), (${to}) ${where} ${changes} ${changeLogs} return from, to`;

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
        // If the start and end nodes were found, they have already had any changes applied - just call createRelation.
        if (result.length > 0) {
          CRUD.createRelation(obj, response);
          session.close();
        }
        else { // If the nodes don't exist, just return the empty array that was received from the node search
          response.end(JSON.stringify(result));
          session.close();
        }
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
