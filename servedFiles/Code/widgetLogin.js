// This class handles everything to do with logging in and out of the website.
class widgetLogin {
  constructor() {
    this.db = new db();

    // DOM elements to be filled in later
    this.info = null; // Will show whether the user is logged in, and if so, their name and role
    this.nameInput = null;
    this.passwordInput = null; // Just what they spund like - the inputs for the user's name and password.
    this.loginButton = null; // Button to click to log in

    // data to fill in when the user logs in - their ID, name and permissions level
    this.userID = null;
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
    // the loginDiv functions as a widget so app.widget can work with it. Over in app, it's also added to the widgets array.
    this.loginDiv.setAttribute("class", "widget");

    // Create a paragraph that says "Not Logged In", with an idr so it can be changed later
    this.info = document.createElement("p");
    this.info.setAttribute("idr", "userInfo");
    const text = document.createTextNode("Not Logged In");
    this.info.appendChild(text);
    this.loginDiv.appendChild(this.info);

    // element to hold the prompts and textboxes for logging in. Visible only when logged out.
    const loginInfo = document.createElement('p');
    this.viewLoggedOut.push(loginInfo);
    this.loginDiv.appendChild(loginInfo);

    // Prompt for username. Appended to loginInfo, so also visible only when logged out.
    const namePrompt = document.createTextNode("Username:");
    loginInfo.appendChild(namePrompt);

    // Textbox to actually store the username. Appended to loginInfo, so also visible only when logged out.
    this.nameInput = document.createElement("input");
    this.nameInput.setAttribute("idr", "userName");
    this.nameInput.setAttribute("onblur", "app.regression.logText(this)");
    loginInfo.appendChild(this.nameInput);

    // Prompt for password. Appended to loginInfo, so also visible only when logged out.
    const passwordPrompt = document.createTextNode("Password: ");
    loginInfo.appendChild(passwordPrompt);

    // Textbox to store the password. Allows you to login by hitting Enter.
    // Appended to loginInfo, so also visible only when logged out.
    this.passwordInput = document.createElement("input");
    this.passwordInput.setAttribute("type", "password");
    this.passwordInput.setAttribute("idr", "password");
    this.passwordInput.setAttribute("onblur", "app.regression.logText(this)");
    this.passwordInput.setAttribute("onkeydown", "app.widget('loginOnEnter', this, event)");
    loginInfo.appendChild(this.passwordInput);

    // Button to log in.
    this.loginButton = document.createElement("input");
    this.loginButton.setAttribute("idr", "loginButton");
    this.loginButton.setAttribute("type", "button");
    this.loginButton.setAttribute("value", "Log In");
    this.loginButton.setAttribute("onclick", "app.widget('login', this)");
    this.loginDiv.appendChild(this.loginButton);

    // Button to show debug header. Visible only when logged in as an admin
    this.debugButton = document.createElement('input');
    this.debugButton.setAttribute('id', 'debugButton');
    this.debugButton.setAttribute('type', 'button');
    this.debugButton.setAttribute('value', 'Show Debug Menu');
    this.debugButton.setAttribute('onclick', 'app.showDebug(this)');
    this.debugButton.setAttribute('hidden', 'true');
    this.loginDiv.appendChild(this.debugButton);
    this.viewAdmin.push(this.debugButton);

    // Button to show regression header. Visible only when logged in as an admin
    this.regressionButton = document.createElement('input');
    this.regressionButton.setAttribute('id', 'regressionButton');
    this.regressionButton.setAttribute('type', 'button');
    this.regressionButton.setAttribute('value', 'Show Regression Menu');
    this.regressionButton.setAttribute('onclick', 'app.showRegression(this)');
    this.regressionButton.setAttribute('hidden', 'true');
    this.loginDiv.appendChild(this.regressionButton);
    this.viewAdmin.push(this.regressionButton);


    // Horizontal line
    const line = document.createElement("hr");
    this.loginDiv.appendChild(line);
  }

  // Called when you hit a key while in the password box. If the key was "Enter", calls the login method.
  loginOnEnter(textBox, evnt) {
    if (textBox == this.passwordInput && evnt.key == "Enter") {
      this.login();
    }
  }

  // Runs when the page loads. Ensures that the Admin and User nodes exist (all admins are connected to the Admin node,
  // and all users are connected to the User node, so they must exist). Searches for users who are admins
  // and sends the results to this.checkAdminUser().
  checkAdminTable() {
    // DBREPLACE DB function: changePattern
    // JSON object: {nodesCreate:[{type:"LoginTable", details:{name:"User"}, merge:true},
    //                           {name:"admin", type:"LoginTable", details:{"name:"Admin"}, merge:true}];
    //              nodesFind:[{name:"user"; type:"people"}];
    //              relsFind:{type:"Permissions"; from:"user"; to:"admin"}}
    this.db.setQuery(`merge (:LoginTable {name: "User"}) merge (admin:LoginTable {name: "Admin"})
                      with admin match (user:people)-[:Permissions]->(admin) return user`);
    this.db.runQuery(this, 'checkAdminUser');
  }

  // If there are no real admins, create a temporary admin account with username and password of "admin".
  // If there ARE real admins, delete the temporary admin account if it exists.
  checkAdminUser(data) {
    if (data.length == 0) { // if no users are admins, create a temporary admin node if it doesn't exist
      // DBREPLACE DB function: changePattern
      // JSON object: {nodesFind: [name:"admin"; type:"LoginTable"; details:{name:"Admin"}];
      //               nodesCreate: [{name:"tempAdmin"; type:"tempAdmin"; details:{name:"Temporary Admin Account"}; merge:true}];
      //               relsCreate: [{from:"tempAdmin"; to:"admin"; type:"Permissions"; details:{username:"admin"; password:"admin"}; merge:true}]}
      this.db.setQuery(`match (admin:LoginTable {name: "Admin"}) merge (tempAdmin:tempAdmin {name: "Temporary Admin Account"})-[temp:Permissions {username:"admin", password:"admin"}]->(admin)`);
      this.db.runQuery();
    }
    else { // if at least one user is an admin, delete the temporary admin node if it exists
      // DBREPLACE DB function: deleteNode
      // JSON object: {type: tempAdmin}
      this.db.setQuery(`match (tempAdmin:tempAdmin) detach delete tempAdmin`);
      this.db.runQuery();
    }
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
      // DBREPLACE DB function: changePattern
      // JSON object: {nodesFind:[{name:"user"; type:"people"}, {name:"table"; type:"LoginTable"}];
      //               relsFind:[{from:"user"; to: "table"; type:"Permissions"; details: {username:name; password:password}}]}
  	  this.db.setQuery(`match (user)-[rel:Permissions {username:"${name}", password:"${password}"}]->(table:LoginTable)
                        return ID(user) as userID, user.name as name, table.name as permissions`);
  	  this.db.runQuery(this, 'loginComplete');
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
      this.userID = data[0].userID; // Log the user in
      this.userName = data[0].name;
      this.permissions = data[0].permissions;
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
      const loginButton = app.domFunctions.getChildByIdr(this.loginDiv, "loginButton");
      loginButton.setAttribute("value", "Log Out");
      loginButton.setAttribute("onclick", "app.widget('logout', this)");
  	 // end elseif (can log in)
    } else {
  		alert ("Multiple such nodes found");
  	}

    // log
    const obj = {};
    obj.id = "loginDiv";
    obj.idr = "loginButton";
    obj.action = "click";
    obj.data = JSON.parse(JSON.stringify(data));
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
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

     // Update login div to let user log in instead of out
     const loginInp = app.domFunctions.getChildByIdr(this.loginDiv, "userName");
     loginInp.removeAttribute("hidden");
     const loginButton = app.domFunctions.getChildByIdr(this.loginDiv, "loginButton");
     loginButton.setAttribute("value", "Log In");
     loginButton.setAttribute("onclick", "app.widget('login', this)");

     this.userID = null; // Log the user out
     this.userName = null;
     this.info.textContent = `Not Logged In`;
     this.info.classList.remove("loggedIn");

     this.nameInput.value = "";
     this.passwordInput.value = "";

     // Log
     const obj = {};
     obj.id = "loginDiv";
     obj.idr = "loginButton";
     obj.action = "click";
     app.regression.log(JSON.stringify(obj));
     app.regression.record(obj);
  }
}
