module.exports = class login {
  constructor(config, uuid, integrity, driver) {
    this.config = config;
    this.uuid = uuid;
    this.integrity = integrity;
    this.driver = driver;
    this.tokens = {};
  }

  /* Calls whatever method the object requested, assuming that method exists.
  obj is an object which contains, among other things:

  "function": a string which is the name of a CRUD function
  "query": The object describing the node(s) and relation(s) the user wants to find/create and any changes to make
            (more details listed before each method)
  */
  runLogin(obj, response) {
    if (obj.function in this) {
      this[obj.function](obj, response);
    }
    else {
      console.log(`Error: ${obj.function} is not a login function.`);
    }
  }

  /* A specific method for logging in a user.
  Takes the username, password, browser name, user request number, and session and browser GUID (if any) as arguments.
  First, if no session GUID was passed in, creates a session.
  Then, if no browser GUID was passed in, merges in a browser node.
  Then, links the session and browser node with a request indicating a login attempt.
  Then, searches for a user with the given name and password.
  Then, if login was successful, creates a token (that is, the session GUID) and stores it, along with the user's information, in the token object

  Responds with a stringified object containing:
  A session GUID (identical to the one passed in, if one WAS passed in; otherwise, the GUID for the node that was created)
  A browser GUID (ditto, except that the node was merged and may have already existed)
  A boolean indicating whether login was successful
  On sucessful login:
    The user's username
    The user's handle
    The user's ID
    The user's GUID
    The user's role (user or admin, for now)
  */
  login(obj, response) {
    const dataObj = obj.query; // dataObj starts off including userName, password, browserName, userRequest, and possibly sessionGUID and browserGUID
    dataObj.server = this; // Adds server object to dataObj
    dataObj.response = response; // adds response to dataObj
    this.createSession(dataObj) // Adds sessionGUID to dataObj, if it didn't already exist
      .then(this.mergeBrowser) // Adds browserGUID to dataObj, if it didn't already exist
      .then(this.linkSession) // Adds requestGUID to dataObj
      .then(this.tryLogin)  // Searches for user with the given credentials; adds result to dataObj
      .then(this.resolveLogin); // Returns the search result, and updates the request to show success or failure
  }

  createSession(dataObj) {
    return new Promise(function(resolve, reject) {
      if (dataObj.sessionGUID) { // If the session already existed, just move along
        resolve(dataObj);
      }
      else { // Otherwise, create a session (and changeLog) and store the session's GUID

        const session = dataObj.server.driver.session();
        dataObj.sessionGUID = dataObj.server.uuid();
        const createChangeNumber = ++dataObj.server.integrity.changeCount;
        const startTime = Date.now();

        const query =
        `create (s:M_Session {M_GUID:"${dataObj.sessionGUID}", startTime:${startTime}, M_CreateChangeLog:${createChangeNumber}}),
                (c0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${dataObj.sessionGUID}", user_GUID:"upkeep",
                  action:"create", label:"M_Session", itemType:"node", M_GUID:"${dataObj.server.uuid()}"}),
                (c1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.sessionGUID}", user_GUID:"upkeep",
                  action:"change", attribute:"startTime", value:"${startTime}", itemType:"node", M_GUID:"${dataObj.server.uuid()}"})`;
        session.run(query)
        .subscribe({
          onCompleted: function() {
            session.close();
            resolve(dataObj);
          },
          onError: function(error) {
            console.log(error);
          }
        });
      }
    });
  }

  mergeBrowser(dataObj) {
    return new Promise(function(resolve, reject) {
      if (dataObj.browserGUID) { // If the browser GUID was already set, just move on.
        resolve(dataObj);
      }
      else { // Otherwise, look for an existing browser node.
        const session = dataObj.server.driver.session();
        const result = [];

        const query = `match (b:M_Browser {name:"${dataObj.browserName}"}) return b.M_GUID as GUID`;
        session.run(query)
        .subscribe({
          onNext: function(record) {
            const obj={};
            for (let i=0; i< record.length; i++) {
              obj[record.keys[i]]=record._fields[i];
            }
            result.push(obj);
          },
          onCompleted: function() {
            session.close();
            if (result.length === 1) { // If there's already a node for this browser, just record its GUID and resolve
              dataObj.browserGUID = result[0].GUID;
              resolve(dataObj);
            }
            else {
              dataObj.server.createBrowser(dataObj) // Otherwise, create one, then record its GUID and resolve (this may not work; have to try it)
                .then(function(browserGUID) {
                  dataObj.browserGUID = browserGUID;
                  resolve(dataObj);
                });
            }
          },
          onError: function(error) {
            console.log(error);
          }
        });
      }
    });
  }

  createBrowser(dataObj) {
    return new Promise(function (resolve, reject) {
      const session = dataObj.server.driver.session();
      const browserGUID = dataObj.server.uuid();
      const createChangeNumber = ++dataObj.server.integrity.changeCount;

      const query =
      `create (b:M_Browser {name:"${dataObj.browserName}", M_GUID:"${browserGUID}", M_CreateChangeLog:${createChangeNumber}}),
      (change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${browserGUID}", user_GUID:"upkeep",
        action:"create", label:"M_Browser", itemType:"node", M_GUID:"${dataObj.server.uuid()}"}),
      (change1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${browserGUID}", user_GUID:"upkeep",
        action:"change", attribute:"name", value:"${dataObj.browserName}", itemType:"node", M_GUID:"${dataObj.server.uuid()}"})`;

      session.run(query)
      .subscribe({
        onCompleted: function() {
          session.close();
          resolve(browserGUID);
        },
        onError: function(error) {
          console.log(error);
        }
      });
    });
  }

  linkSession(dataObj) {
    return new Promise(function(resolve, reject) {
      const session = dataObj.server.driver.session();
      const createChangeNumber = ++dataObj.server.integrity.changeCount;
      dataObj.requestGUID = dataObj.server.uuid();
      dataObj.startTime = Date.now();

      const request = `
        match (s:M_Session {M_GUID:"${dataObj.sessionGUID}"}), (b:M_Browser {M_GUID:"${dataObj.browserGUID}"})
        create (s)-[l:Request {userRequest:"${dataObj.userRequest}", serverRequest:"0", description:"Logging in",
        startTime:"${dataObj.startTime}", M_GUID:"${dataObj.requestGUID}", M_CreateChangeLog:${createChangeNumber}}]->(b),
        (change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
          action:"create", label:"Request", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
        (change1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
          action:"change", attribute:"userRequest", value:"${dataObj.userRequest}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
        (change2:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
          action:"change", attribute:"serverRequest", value:"0", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
        (change3:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
          action:"change", attribute:"description", value:"Logging in", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
        (change4:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
          action:"change", attribute:"startTime", value:"${dataObj.startTime}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"})`;

      session.run(request)
      .subscribe({
        onCompleted: function() {
          resolve(dataObj);
        },
        onError: function(err) {
          console.log(err);
        }
      });
    });
  }

  tryLogin(dataObj) {
    return new Promise(function(resolve, reject) {
      const session = dataObj.server.driver.session();
      let result = [];

      const query = `match (n)-[:Permissions {username:"${dataObj.userName}", password:"${dataObj.password}"}]->(l:M_LoginTable)
                     return n.name as name, ID(n) as ID, n.M_GUID as GUID, l.name as role`;
      session.run(query)
      .subscribe({
        onNext: function(record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          result.push(obj);
        },
        onCompleted: function() {
          dataObj.result = result;
          resolve(dataObj);
        },
        onError: function(error){
          console.log(error);
        }
      });
    });
  }

  resolveLogin(dataObj) {
    const returnObj = {};
    returnObj.sessionGUID = dataObj.sessionGUID;
    returnObj.browserGUID = dataObj.browserGUID;
    const duration = Date.now() - dataObj.startTime;
    let query = "";

    if (dataObj.result.length === 1) {
      returnObj.success = true;
      returnObj.userName = dataObj.result[0].name;
      returnObj.handle = dataObj.userName;
      returnObj.ID = dataObj.result[0].ID;
      returnObj.GUID = dataObj.result[0].GUID;
      returnObj.role = dataObj.result[0].role;

      const tokens = dataObj.server.tokens; // Add this session GUID to the list of tokens, and set a timer to remove it in a set time
      tokens[dataObj.sessionGUID] = {
        "handle":dataObj.userName,
        "username":dataObj.result[0].name,
        "userID":dataObj.result[0].ID,
        "userGUID":dataObj.result[0].GUID,
        "userRole":dataObj.result[0].role,
        "browserGUID":dataObj.browserGUID,
        timer: setTimeout(function(){
          delete tokens[dataObj.sessionGUID];
        }, dataObj.server.config.timerDurationMS)
      };

      // record successful login
      query = `match ()-[r:Request {M_GUID:"${dataObj.requestGUID}"}]->() set r.result = "succeeded", r.duration = "${duration}"
               with r create (c0:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
                action:"change", attribute:"result", value:"succeeded", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
               (c1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
                action:"change", attribute:"duration", value:"${duration}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"})`;
    }
    else {
      returnObj.success = false;

      // record failed login
      query = `match ()-[r:Request {M_GUID:"${dataObj.requestGUID}"}]->() set r.result = "failed", r.duration = "${duration}"
               with r create (c0:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
                action:"change", attribute:"result", value:"failed", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"}),
               (c1:M_ChangeLog {number:${++dataObj.server.integrity.changeCount}, item_GUID:"${dataObj.requestGUID}", user_GUID:"upkeep",
                action:"change", attribute:"duration", value:"${duration}", itemType:"relation", M_GUID:"${dataObj.server.uuid()}"})`;
    }
    const session = dataObj.server.driver.session();
    session.run(query)
    .subscribe({
      onCompleted: function(){
        dataObj.response.end(JSON.stringify(returnObj));
      },
      onError: function(err){
        console.log(err);
      }
    });
  }

  logout(obj, response) {
    // Logs the user out by adding an end time to the session, adding a logout request between the session and browser, and removing the token from the list
    const dataObj = obj.query;

    delete this.tokens[dataObj.sessionGUID];

    const session = this.driver.session();
    const requestGUID = this.uuid();
    const now = Date.now();
    const createChangeNumber = ++this.integrity.changeCount;

    const query = `match (s:M_Session {M_GUID: "${dataObj.sessionGUID}"}), (b:M_Browser {M_GUID: "${dataObj.browserGUID}"})
    set s.endTime = "${now}" with s, b
    create (s)-[r:Request {userRequest:"${dataObj.userRequest}", serverRequest:"0", description:"Logging out",
      startTime:"${now}", M_GUID:"${requestGUID}", M_CreateChangeLog:"${createChangeNumber}"}]->(b),
    (change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
      action:"create", label:"Request", itemType:"relation", M_GUID:"${this.uuid()}"}),
    (change1:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
      action:"change", attribute:"userRequest", value:"${dataObj.userRequest}", itemType:"relation", M_GUID:"${this.uuid()}"}),
    (change2:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
      action:"change", attribute:"serverRequest", value:"0", itemType:"relation", M_GUID:"${this.uuid()}"}),
    (change3:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
      action:"change", attribute:"description", value:"Logging out", itemType:"relation", M_GUID:"${this.uuid()}"}),
    (change4:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${requestGUID}", user_GUID:"upkeep",
      action:"change", attribute:"startTime", value:"${now}", itemType:"relation", M_GUID:"${this.uuid()}"}),
    (change5:M_ChangeLog {number:${++this.integrity.changeCount}, item_GUID:"${dataObj.sessionGUID}", user_GUID:"upkeep",
      action:"change", attribute:"endTime", value:"${now}", itemType:"node", M_GUID:"${this.uuid()}"})`;

    session.run(query)
    .subscribe({
      onCompleted:function() {
        session.close();
        response.end();
      },
      onError:function(err) {
        console.log(err);
      }
    });
  }
}
