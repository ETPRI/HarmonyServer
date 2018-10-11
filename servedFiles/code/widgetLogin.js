// This class handles everything to do with logging in and out of the website.
class widgetLogin {
  constructor() {
    // DOM elements to be filled in later
    this.info = null; // Will show whether the user is logged in, and if so, their name and role
    this.nameInput = null;
    this.passwordInput = null; // Just what they spund like - the inputs for the user's name and password.
    this.loginButton = null; // Button to click to log in

    // data to fill in when the user logs in - their ID, name and permissions level
    this.sessionGUID = null;
    this.browserGUID = null;
    this.requestCount = 0;
    this.userID = null;
    this.userGUID = null;
    this.userName = null;
    this.permissions = null;

    this.viewLoggedIn = []; // Arrays of DOM elements that should be visible only when logged in...
    this.viewLoggedOut = []; // logged out...
    this.viewAdmin = []; // or logged in as an admin

    // Arrays of objects, each containing object, objectMethod, and parameters, to run when logging in or out
    // Example: {object:widgetView, method:"onLogin", args:[]}
    this.doOnLogin = [];
    this.doOnLogout = [];

    // Find an element with the ID "loginDiv" and build the widget there.
    // You can build your own and manually call these functions instead, if you really want to.
    this.loginDiv = document.getElementById("loginDiv");
    if (!(this.loginDiv == null)) {
      this.buildLoginWidget();
    }
  }

  // Creates all the controls for logging in - text boxes for your name and password (visible only when you're logged out),
  // a login/logout button that changes when you log in or out, an info paragraph that shows who's logged in, and prompts for
  // the name and password. These are placed in the element with ID loginDiv (if no such element exists, this is not called).
  buildLoginWidget() {
    // needs to come from ../view/widgetLogin.html

    // code below that deals with visual aspects and is or could be moved to widgetLogin.html should be removed.
    // to be reviewed and removed if possible

    // the loginDiv functions as a widget so app.widget can work with it. Over in app, it's also added to the widgets array.
    this.loginDiv.setAttribute("class", "widget");
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        // update page with result from server
      app.login.loginDiv.innerHTML = this.responseText;

      // Set variables
      app.login.nameInput = document.getElementById("userName");
      app.login.passwordInput = document.getElementById("password");
      app.login.loginButton = document.getElementById("loginButton");
      app.login.info = document.getElementById("userInfo");

      // Create debug and regression headers and link to debug and regression buttons in login header
      app.createDebug();
      const headerExists = !(document.getElementById("regressionHeader") == null);
      if (headerExists) {
        app.regression.buildRegressionHeader();
        app.login.viewAdmin.push(document.getElementById("debugButton"));
        app.login.viewAdmin.push(document.getElementById("regressionButton"));
      }

      // The <p> containing the login fields is only visible when logged out
      app.login.viewLoggedOut.push(app.login.nameInput.parentElement);
      }
    };

    xhttp.open("GET", "widgetLogin.html");
    xhttp.send();
  }

  // Called when you hit a key while in the password box. If the key was "Enter", calls the login method.
  loginOnEnter(textBox, evnt) {
    if (textBox == this.passwordInput && evnt.key == "Enter") {
      this.createSession();
    }
  }

  // Creates a session node and then calls mergeBrowser to create a browser node, if necessary.
  createSession() {
    // If a session is already ongoing (say, from a failed login attempt), skip straight to recording the request
    if (this.sessionGUID && this.browserGUID) {
      this.login();
    }
    else { // Otherwise, create a session and browser node first, then record the request
      const obj = {"type":"M_Session", "properties":{"startTime":Date.now()}};

      const xhttp = new XMLHttpRequest();
      const login = this;
      const update = app.startProgress(this.loginDiv, "Creating session");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          login.sessionGUID = data[0].node.properties.M_GUID;
          login.requestCount = 0;
          app.stopProgress(login.loginDiv, update);
          login.mergeBrowser();
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "createNode", "query": obj, "GUID": "setup"};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }
  }

  // Merges in a browser node and calls login
  mergeBrowser() {
    const obj = {};
    obj.node = {"type":"M_Browser", "properties":{"name":navigator.userAgent}, "merge":true};

    const xhttp = new XMLHttpRequest();
    const login = this;
    const update = app.startProgress(this.loginDiv, "Creating session");

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        login.browserGUID = data[0].node.properties.M_GUID;
        app.stopProgress(login.loginDiv, update);
        login.login();
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": "setup"};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  // Checks to make sure the user entered both a name and password, then searches for a user with that name and password.
  // Does NOT currently encrypt the password - need to fix before going public. Sends results to this.loginComplete().
  login() {
  	const name = this.nameInput.value;
    const password = this.passwordInput.value;

    if (name == "" || password == "") { // If the user didn't enter a name and password, don't even bother trying to log in.
      alert("Enter your name and password first!");
    }
    else {
      const obj = {};
      obj.from = {"name":"user"};
      obj.to = {"name":"table", "type":"M_LoginTable"};
      obj.rel = {"type":"Permissions", "properties":{"username":name, "password":password}, "return":false};

      const xhttp = new XMLHttpRequest();
      const login = this;
      const update = app.startProgress(this.loginDiv, "Logging In");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          app.stopProgress(login.loginDiv, update);
          login.loginComplete(data);
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": "setup"};
      xhttp.send(JSON.stringify(queryObject));         // send request to server
    }
  }

  // If exactly one node with the given name and password is found, logs the user in. Sets the userID, userName,
  // and permissions to those of the logged-in user, updates the info paragraph to show that the user is logged in,
  // then hides/reveals items and calls methods as appropriate when this user logs in. If there ISN'T exactly one
  // node with the given name and password, produces an error message and does not log the user in.
  loginComplete(data) {
  	if (data.length == 0) {
  		alert ("No such node found");
  	}

  	else if (data.length == 1) { // Can actually log in
      this.userID = data[0].user.id; // Log the user in
      this.userName = data[0].user.properties.name;
      this.userGUID = data[0].user.properties.M_GUID;
      this.permissions = data[0].table.properties.name;
  		this.info.textContent = `Logged in as ${this.userName} -- Role: ${this.permissions}`;
      this.info.classList.add('loggedIn');

      for (let i in this.viewLoggedIn) { // Show all items that are visible when logged in
        this.viewLoggedIn[i].removeAttribute("hidden");
      }

      for (let i in this.viewLoggedOut) { // Hide all items that are visible when logged out
        this.viewLoggedOut[i].setAttribute("hidden", "true");
      }

      if (this.permissions == "Admin") { // If the user is an admin...
        for (let i in this.viewAdmin) { // show all items that are visible when logged in as an admin
          this.viewAdmin[i].removeAttribute("hidden");
        }
      }

      for (let i in this.doOnLogin) { // Run all methods that run when a user logs in
        const object = this.doOnLogin[i].object;
        const method = this.doOnLogin[i].method;
        const args = this.doOnLogin[i].args;
        if (object) { // Assuming the object that was provided still exists...
          object[method](...args); // run the method in the object with the args.
        }
      }

      // Add "myTrash" to metadata options
      const dropDown = document.getElementById("metaData");
      const option = document.createElement('option');
      option.setAttribute("idr", "myTrash");
      option.setAttribute("value", "myTrash");
      option.appendChild(document.createTextNode("My Trashed Nodes"));
      dropDown.appendChild(option);

      // Turn login button into logout button
      this.loginButton.setAttribute("value", "Log Out");
      this.loginButton.setAttribute("onclick", "app.widget('logout', this)");

      // Link the user to the session, then call the getMetaData function to search for metadata
      const obj = {};
      obj.from = {"properties":{"M_GUID":this.userGUID}};
      obj.rel = {"type":"User"};
      obj.to = {"type":"M_Session", "properties":{"M_GUID":this.sessionGUID}};

      const xhttp = new XMLHttpRequest();
      const login = this;
      const update = app.startProgress(this.loginDiv, "Linking session");

      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          app.stopProgress(login.loginDiv, update);
          login.getMetaData();
        }
      };

      xhttp.open("POST","");
      const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": "setup"};
      xhttp.send(JSON.stringify(queryObject));         // send request to server

  	 // end elseif (can log in)
    } else {
  		alert ("Multiple such nodes found");
  	}

    // log
    const obj2 = {};
    obj2.id = "loginDiv";
    obj2.idr = "loginButton";
    obj2.action = "click";
    obj2.data = JSON.parse(JSON.stringify(data));
    app.stripIDs(obj2.data);
    app.regression.log(JSON.stringify(obj2));
    app.regression.record(obj2);
  }

  getMetaData() {
    // Get the metadata nodes, and search for any links between them and this user
    const obj = {};
    obj.required = {"type":"M_MetaData", "name":"metadata"};
    obj.rel = {"type":"Settings", "name":"settings", "direction":"left"};
    obj.optional = {"id":this.userID, "return":false};

    const xhttp = new XMLHttpRequest();
    const login = this;
    const update = app.startProgress(this.loginDiv, "Restoring settings");

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        app.stopProgress(login.loginDiv, update);
        login.updateMetaData(data);
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "CRUD", "function": "findOptionalRelation", "query": obj, "GUID": "setup"};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  updateMetaData(data) {
    let buttons = document.getElementById('buttons');
    let adminButtons = document.getElementById('adminButtons');

  	// clear existing options
    buttons.innerHTML = "";
    adminButtons.innerHTML = "";

    // data should be an array of objects, each of which contains:
    // a) a metadata object containing the name of the metadata object to update, and maybe
    // b) a settings object whose properties are used to update metadata
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = row.metadata.properties.name;

      if (row.settings) { // If a settings relation was found
        let settings = row.settings.properties;
        delete settings.M_GUID; // all other properties should be stored in app.metadata

        // parse all properties
        for (let prop in settings) {
          settings[prop] = JSON.parse(settings[prop]);
        }

        // Add any missing values to settings, then store it in app.metaData
        app.updateObject(app.metaData.node[name], settings);
        app.metaData.node[name] = settings;
      }

      // let properties = row.metadata.properties; // default values
      // const name = properties.name;
      //
      // const propertyNames = ['fieldsDisplayed', 'formFieldsDisplayed', 'nodeLabel', 'orderBy'];
      // for (let i = 0; i < propertyNames.length; i++) {
      //   if (row.settings && row.settings.properties[propertyNames[i]]) { // user-specific values overrule defaults if they are present, except for "fields"
      //     properties[propertyNames[i]] = row.settings.properties[propertyNames[i]];
      //   }
      //
      //   if (properties[propertyNames[i]]) {
      //     app.metaData.node[name][propertyNames[i]] = JSON.parse(properties[propertyNames[i]]);
      //   }
      // }
      //
      // // Now check the fields. If a field is in the relation, then overwrite THAT SPECIFIC FIELD in properties.
      // let fields = JSON.parse(properties.fields); // fields from metadata object
      // if (row.settings && row.settings.properties.fields) {
      //   const relFields = JSON.parse(row.settings.properties.fields); // fields from relation
      //   for (let name in relFields) {
      //     // Replace label (and if, somehow, the user had a field the node didn't, add it)
      //     fields[name] = relFields[name];
      //   } // end for (every field in the relation)
      // } // end if (there are fields stored in the relation)
      //
      // // Then plug the result into app.metaData.node[name].fields
      // app.metaData.node[name].fields = fields;

      // Create a widgetTableNodes widget for this node type
      app.widgets[name] = new widgetTableNodes(name, null);

      // Create a button for this nodeType
      const button = document.createElement('input');
      if (name.slice(0,2) === "M_") { // If this button represents a metadata node type, only admins should see it
        adminButtons.append(button);
      }
      else {
        buttons.append(button);
      }

      button.outerHTML = `<input type="button" value="${app.metaData.node[name].nodeLabel}" onclick="app.menuNodes('${name}')">`
    } // end for (each metadata node)
  }

  // Logs the user out: resets login information to null, resets the info paragraph to say "not logged in",
  // then hides/reveals items and calls methods as appropriate on logout.
  logout(button) {
    for (let i in this.viewLoggedOut) { // Show all items that are visible when logged out
      this.viewLoggedOut[i].removeAttribute("hidden");
    }

    for (let i in this.viewLoggedIn) { // Hide all items that are visible when logged in
      this.viewLoggedIn[i].setAttribute("hidden", "true");
    }

    for (let i in this.viewAdmin) { // Hide all items that are visible when logged in as an admin
      this.viewAdmin[i].setAttribute("hidden", "true");
    }

    for (let i in this.doOnLogout) { // Run all methods that run when a user logs out
      const object = this.doOnLogout[i].object;
      const method = this.doOnLogout[i].method;
      const args = this.doOnLogout[i].args;
      object[method](...args);
    }

    // Remove the last option, which should be "myTrash", from metadata options
    const dropDown = document.getElementById("metaData");
     dropDown.remove(dropDown.length-1);

     this.loginButton.setAttribute("value", "Log In");
     this.loginButton.setAttribute("onclick", "app.widget('login', this)");

     this.userID = null; // Log the user out
     this.userGUID = null;
     this.userName = null;
     this.permissions = null;
     this.info.textContent = `Not Logged In`;
     this.info.classList.remove("loggedIn");

     this.nameInput.value = "";
     this.passwordInput.value = "";

     const obj = {};
     obj.node = {"type":"M_Session", "properties":{"M_GUID":this.sessionGUID}};
     obj.changes = [{"item":"node", "property":"endTime", "value":Date.now()},];

     const xhttp = new XMLHttpRequest();

     xhttp.open("POST","");
     const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": "upkeep"};
     xhttp.send(JSON.stringify(queryObject));         // send request to server

     this.sessionGUID = null;
     this.browserGUID = null;
     this.requestCount = 0;

     // Log
     const obj2 = {};
     obj2.id = "loginDiv";
     obj2.idr = "loginButton";
     obj2.action = "click";
     app.regression.log(JSON.stringify(obj2));
     app.regression.record(obj2);
  }
}
