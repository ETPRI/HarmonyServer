/*

small web server that serves static files and a
REST API into a database

ideas to think about
create server status object accessable by admin

*/

var http = require('http');      //
var fs   = require('fs');        // access local file system
var path = require('path');      // ?
var url  = require('url');
var uuidv1 = require('uuid/v1');                // create GUID based on mac address, and date/time
var integrityClass = require('./integrity');    // check consistency of database
var CRUDclass = require('./CRUD');              // REST API to database, rewrite for each back end
var backupClass = require('./backup');          // back up database to local file?
var loginClass = require('./login');            // login and logout
const config = require('./config');             // configure file locations, ports, etc on server

// connect to db server, neo4j
const neo4j  = require('neo4j-driver').v1;
// Create a driver instance, for the user neo4j with password neo4j.
// It should be enough to have a single driver per database per application.
const driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", config.neo4j.password));

// create instances of required classes
let backup = new backupClass(config, fs, driver, stringEscape);
let integrity = new integrityClass(driver, uuidv1, stringEscape, true);
let CRUD = new CRUDclass(uuidv1, integrity, driver, stringEscape);
let login = new loginClass(config, uuidv1, integrity, driver);

// process requests to server
http.createServer(function (request, response) {
    // find out if client is running on same machine as server
    let source = "Remote ";
    if (request.headers.host === `127.0.0.1:${config.port}` || request.headers.host === `localhost:${config.port}`) {
      source = "Local ";
    }

    console.log(source, 'request ', request.url);

    var q = url.parse(request.url, true);
    response.setHeader('Access-Control-Allow-Origin', '*');  // ?

    if (q.pathname === "/get"){
      // reading a form, not using Gremlin now
      // console.log("get: %s\n", JSON.stringify(q.query));
      // response.statusCode = 200;
      // response.setHeader('Content-Type', 'text/plain');
      // runGremlin(q.query.gremlinSteps, response);
      // return;
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
          case "CRUD":
            if (obj.token === "upkeep") {
              CRUD.runCRUD(obj, response);
            }
            else if (tokenExists(obj.token)) {
              updateTokenTimer(obj.token);
              CRUD.runCRUD(obj, response);
            }
            else {
              response.end("timeout");
            }
            break;
          case "file":
            runFileRequest(obj, response);
            break;
          case "neo4j":
            runNeo4j(obj.query, response);
            break;
          case "login":
            login.runLogin(obj, response);
            break;
          // case "gremlin":
          //   runGremlin2(obj.query, response);
          //   break;
          case "backupNeo4j":
            backup.processBackup(obj.query, response);
            break;
          default:
            // get error to user, add to server log
            console.log("Error server = %s\n", obj.server );
        }
      });
      return;
    }

    // serve static file
    var filePath = config.servedDirectory;  // default location of served files relative to where server is
    if (request.url === "/") {
      // serve the defalut application
      filePath += config.defaultAppDirectory+"/app.html"
    } else if (request.url.lastIndexOf('/')  === 0) {
      // serve file from default application directory
      filePath += config.defaultAppDirectory+request.url;
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

    if (query.fileBinary) {
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

      let fileBinaryArray = [];
      Object.keys(query.fileBinary).map(function(key){
        fileBinaryArray[key] = query.fileBinary[key];
      });

      fs.writeFile(fileName, Buffer.from(fileBinaryArray), (err) => {
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
            const buffer = fs.readFileSync(nodePath);
            // const data = new Uint8Array(buffer);
            response.end(buffer);
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

function runLoginCode(obj, response) {
  switch (obj.function) {
    case "login":
      login(obj, response);
      break;
    case "logout":
      logout(obj, response);
      break;
  }
}

  //--------------------------------Login code---------------------------------

  // this.tokens = {};
  // this.timerDurationMS = 30*60*1000; // 30 minutes
  //
  // /* A specific method for logging in a user.
  // Takes the username, password, browser name, user request number, and session and browser GUID (if any) as arguments.
  // First, if no session GUID was passed in, creates a session.
  // Then, if no browser GUID was passed in, merges in a browser node.
  // Then, links the session and browser node with a request indicating a login attempt.
  // Then, searches for a user with the given name and password.
  // Then, if login was successful, creates a token (that is, the session GUID) and stores it, along with the user's information, in the token object
  //
  // Responds with a stringified object containing:
  // A session GUID (identical to the one passed in, if one WAS passed in; otherwise, the GUID for the node that was created)
  // A browser GUID (ditto, except that the node was merged and may have already existed)
  // A boolean indicating whether login was successful
  // On sucessful login:
  //   The user's username
  //   The user's handle
  //   The user's ID
  //   The user's GUID
  //   The user's role (user or admin, for now)
  // */
  // function login(obj, response) {
  //   const dataObj = obj.query; // dataObj starts off including userName, password, browserName, userRequest, and possibly sessionGUID and browserGUID
  //   dataObj.server = this; // Adds server object to dataObj
  //   dataObj.response = response; // adds response to dataObj
  //   createSession(dataObj) // Adds sessionGUID to dataObj, if it didn't already exist
  //     .then(mergeBrowser) // Adds browserGUID to dataObj, if it didn't already exist
  //     .then(linkSession) // Adds requestGUID to dataObj
  //     .then(tryLogin)  // Searches for user with the given credentials; adds result to dataObj
  //     .then(resolveLogin); // Returns the search result, and updates the request to show success or failure
  // }
  //
  // function createSession(dataObj) {
  //   return new Promise(function(resolve, reject) {
  //     if (dataObj.sessionGUID) { // If the session already existed, just move along
  //       resolve(dataObj);
  //     }
  //     else { // Otherwise, create a session (and changeLog) and store the session's GUID
  //
  //       const session = dataObj.server.driver.session;
  //       dataObj.sessionGUID = dataObj.server.uuid();
  //       const createChangeNumber = ++dataObj.server.integrity.changeCount;
  //       const startTime = Date.now();
  //
  //       const query =
  //       `create (s:M_Session {M_GUID:${dataObj.sessionGUID}, startTime:${startTime}}),
  //               (c0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${dataObj.sessionGUID}", user_GUID:"upkeep",
  //                 action:"create", label:"M_Session", itemType:"node", M_GUID:"${dataObj.server.uuid()}"}),
  //               (c1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.sessionGUID}", user_GUID:"upkeep",
  //                 action:"change", attribute:"startTime", value:"${startTime}", itemType:"node", M_GUID:"${dataObj.server.uuid()}"})`;
  //       session.run(query)
  //       .subscribe({
  //         onCompleted: function() {
  //           session.close();
  //           resolve(dataObj);
  //         },
  //         onError: function(error) {
  //           console.log(error);
  //         }
  //       });
  //     }
  //   });
  // }
  //
  // function mergeBrowser(dataObj) {
  //   return new Promise(function(resolve, reject) {
  //     if (dataObj.browserGUID) { // If the browser GUID was already set, just move on.
  //       resolve(dataObj);
  //     }
  //     else { // Otherwise, look for an existing browser node.
  //       const session = dataObj.server.driver.session;
  //       const result = [];
  //
  //       const query = `match (b:M_Browser {name:"${dataObj.browserName}"}) return b.M_GUID as GUID`;
  //       session.run(query)
  //       .subscribe({
  //         onNext: function(record) {
  //           const obj={};
  //           for (let i=0; i< record.length; i++) {
  //             obj[record.keys[i]]=record._fields[i];
  //           }
  //           result.push(obj);
  //         },
  //         onCompleted: function() {
  //           session.close();
  //           if (result.length === 1) { // If there's already a node for this browser, just record its GUID and resolve
  //             dataObj.browserGUID = result[0].GUID;
  //             resolve(dataObj);
  //           }
  //           else {
  //             createBrowser(dataObj) // Otherwise, create one, then record its GUID and resolve (this may not work; have to try it)
  //               .then(function(browserGUID) {
  //                 dataObj.browserGUID = browserGUID;
  //                 resolve(dataObj);
  //               });
  //           }
  //         },
  //         onError: function(error) {
  //           console.log(error);
  //         }
  //       });
  //     }
  //   });
  // }
  //
  // function createBrowser(dataObj) {
  //   return new Promise(function (resolve, reject) {
  //     const session = dataObj.server.driver.session;
  //     const browserGUID = dataObj.server.uuid();
  //     const createChangeNumber = ++dataObj.server.integrity.changeCount;
  //
  //     const query =
  //     `create (b:M_Browser {name:"${dataObj.browserName}", M_GUID:${browserGUID}}),
  //     (change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${browserGUID}", user_GUID:"upkeep",
  //       action:"create", label:"M_Browser", itemType:"node", M_GUID:"${dataObj.server.uuid()}"}),
  //     (change1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${browserGUID}", user_GUID:"upkeep",
  //       action:"change", attribute:"name", value:"${dataObj.browserName}", itemType:"node", M_GUID:"${dataObj.server.uuid()}"})`;
  //
  //     session.run(query)
  //     .subscribe({
  //       onCompleted: function() {
  //         session.close();
  //         resolve(browserGUID);
  //       },
  //       onError: function(error) {
  //         console.log(error);
  //       }
  //     });
  //   });
  // }
  //
  // function linkSession(dataObj) {
  //   return new Promise(function(resolve, reject) {
  //     const session = dataObj.server.driver.session();
  //     const createChangeNumber = ++dataObj.server.integrity.changeCount;
  //     dataObj.requestGUID = dataObj.server.uuid();
  //     dataObj.startTime = Date.now();
  //
  //     const request = `
  //       match (s:M_Session {M_GUID:"${dataObj.sessionGUID}"}), (b:M_Browser {M_GUID:"${dataObj.browserGUID}"})
  //       create (s)-[l:Request {userRequest:"${dataObj.userRequest}", serverRequest:"0", description:"Logging in",
  //       startTime:"${startTime}", M_GUID:"${dataObj.requestGUID}", M_CreateChangeLog:${createChangeNumber}}]->(b),
  //       (change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
  //         action:"create", label:"Request", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
  //       (change1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //         action:"change", attribute:"userRequest", value:"${dataObj.userRequest}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
  //       (change2:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //         action:"change", attribute:"serverRequest", value:"0", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
  //       (change3:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //         action:"change", attribute:"description", value:"Logging in", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
  //       (change4:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //         action:"change", attribute:"startTime", value:"${startTime}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"})`;
  //
  //     session.run(request)
  //     .subscribe({
  //       onCompleted: function() {
  //         resolve(dataObj);
  //       },
  //       onError: function(err) {
  //         console.log(err);
  //       }
  //     });
  //   });
  // }
  //
  // function tryLogin(dataObj) {
  //   return new Promise(function(resolve, reject) {
  //     const session = dataObj.server.driver.session();
  //     let result = [];
  //
  //     const query = `match (n)-[:Permissions {username:"${dataObj.userName}", password:"${dataObj.password}"}]->(l:M_LoginTable)
  //                    return n.name as name, ID(n) as ID, n.M_GUID as GUID, l.name as role`;
  //     session.run(query)
  //     .subscribe({
  //       onNext: function(record) {
  //         const obj={};
  //         for (let i=0; i< record.length; i++) {
  //           obj[record.keys[i]]=record._fields[i];
  //         }
  //         result.push(obj);
  //       },
  //       onCompleted: function() {
  //         dataObj.result = result;
  //         resolve(dataObj);
  //       },
  //       onError: function(error){
  //         console.log(error);
  //       }
  //     });
  //   });
  // }
  //
  // function resolveLogin(dataObj) {
  //   const returnObj = {};
  //   returnObj.sessionGUID = dataObj.sessionGUID;
  //   returnObj.browserGUID = dataObj.browserGUID;
  //   const duration = Date.now() - dataObj.startTime;
  //   let query = "";
  //
  //   if (dataObj.result.length === 1) {
  //     returnObj.success = true;
  //     returnObj.userName = dataObj.result[0].name;
  //     returnObj.ID = dataObj.result[0].ID;
  //     returnObj.GUID = dataObj.result[0].GUID;
  //     returnObj.role = dataObj.result[0].role;
  //
  //     const tokens = this.tokens; // Add this session GUID to the list of tokens, and set a timer to remove it in a set time
  //     tokens[dataObj.sessionGUID] = {
  //       "handle":dataObj.userName,
  //       "username":dataObj.result[0].name,
  //       "userID":dataObj.result[0].ID,
  //       "userGUID":dataObj.result[0].GUID,
  //       "userRole":dataObj.result[0].role,
  //       "browserGUID":dataObj.browserGUID,
  //       timer: setTimeout(function(){
  //         delete tokens[dataObj.sessionGUID];
  //       }, dataObj.server.timerDurationMS)
  //     };
  //
  //     // record successful login
  //     query = `match ()-[r:Request {M_GUID:${dataObj.requestGUID}}]->() set r.result = "succeeded", r.duration = "${duration}"
  //              with r create (c0:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //               action:"change", attribute:"result", value:"succeeded", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
  //              (c1:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //               action:"change", attribute:"duration", value:"${duration}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"})`;
  //   }
  //   else {
  //     returnObj.success = false;
  //
  //     // record failed login
  //     query = `match ()-[r:Request {M_GUID:${dataObj.requestGUID}}]->() set r.result = "failed", r.duration = "${duration}"
  //              with r create (c0:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //               action:"change", attribute:"result", value:"failed", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
  //              (c1:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
  //               action:"change", attribute:"duration", value:"${duration}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"})`;
  //   }
  //   const session = this.driver.session();
  //   session.run(query)
  //   .subscribe({
  //     onCompleted: function(){
  //       dataObj.response.end(JSON.stringify(returnObj));
  //     },
  //     onError: function(err){
  //       console.log(err);
  //     }
  //   });
  // }
  //
  // function logout(obj, response) {
  //   // Logs the user out by adding an end time to the session, adding a logout request between the session and browser, and removing the token from the list
  //   const dataObj = obj.query;
  //
  //   delete this.tokens[dataObj.sessionGUID];
  //
  //   const session = this.driver.session();
  //   const requestGUID = this.uuid();
  //   const now = Date.now();
  //   const createChangeNumber = ++integrity.changeCount;
  //
  //   const query = `match (s:M_Session {M_GUID: "${dataObj.sessionGUID}"}), (b:M_Browser {M_GUID: "${dataObj.browserGUID}"})
  //   set s.endTime = "${now}" with s, b
  //   create (s)-[r:Request {{userRequest:"${dataObj.userRequest}", serverRequest:"0", description:"Logging out",
  //     startTime:"${now}", M_GUID:"${requestGUID}", M_CreateChangeLog:"${createChangeLog}"}]->(b),
  //   (change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
  //     action:"create", label:"Request", itemType:"relation", M_GUID:"${uuid()}"}),
  //   (change1:M_ChangeLog {number:${++integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
  //     action:"change", attribute:"userRequest", value:"${dataObj.userRequest}", itemType:"relation", M_GUID:"${uuid()}"}),
  //   (change2:M_ChangeLog {number:${++integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
  //     action:"change", attribute:"serverRequest", value:"0", itemType:"relation", M_GUID:"${uuid()}"}),
  //   (change3:M_ChangeLog {number:${++integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
  //     action:"change", attribute:"description", value:"Logging out", itemType:"relation", M_GUID:"${uuid()}"}),
  //   (change4:M_ChangeLog {number:${++integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
  //     action:"change", attribute:"startTime", value:"${now}", itemType:"relation", M_GUID:"${uuid()}"}),
  //   (change5:M_ChangeLog {number:${++integrity.changeCount}, item_GUID:"${dataObj.sessionGUID}", user_GUID:"upkeep",
  //     action:"change", attribute:"endTime", value:"${now}", itemType:"node", M_GUID:"${uuid()}"})`;
  //
  //   session.run(query)
  //   .subscribe({
  //     onCompleted:function() {
  //       session.close();
  //       response.end();
  //     },
  //     onError:function(err) {
  //       console.log(err);
  //     }
  //   });
  // }

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

function tokenExists(token) {
  return (token in login.tokens);
}

function updateTokenTimer(token) {
  clearTimeout(login.tokens[token].timer)
  login.tokens[token].timer = setTimeout(function() {
    delete login.tokens[token];}, config.timerDurationMS);
}

function stringEscape(text) {
  let string = JSON.stringify(text);
  string = string.substring(1, string.length-1);
  // if (string.indexOf("'") > -1) {
  //   string = string.replace(/'/g, "\\'");
  // }
  return string;
}
