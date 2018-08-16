// This class handles everything to do with logging in and out of the website.
class widgetLogin {
  constructor() {

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
    // needs to come from ../view/widgetLogin.html

    // code below that deals with visual aspects and is or could be moved to widgetLogin.html sould be removed.
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
      this.login();
    }
  }

  // Runs when the page loads. Ensures that the Admin and User nodes exist (all admins are connected to the Admin node,
  // and all users are connected to the User node, so they must exist). Searches for users who are admins
  // and sends the results to this.checkAdminUser().
  checkAdminTable() { // start by merging the User table...
    const obj = {};
    obj.merge = true;
    obj.type = "LoginTable";
    obj.properties = {};
    obj.properties.name = "User";
    obj.return = false;
    app.nodeFunctions.createNode(obj, this, "mergeAdmin");
  }

  mergeAdmin() { // then merge the Admin table...
    const obj = {};
    obj.merge = true;
    obj.type = "LoginTable";
    obj.properties = {};
    obj.properties.name = "Admin";
    obj.return = false;
    app.nodeFunctions.createNode(obj, this, "checkAdmin");
  }

  checkAdmin() { // Now we know that the admin table exists. Search for any person with a link to it.
    const obj = {};
    obj.from = {};
    obj.from.name = "user";
    obj.from.type = "people";
    obj.to = {};
    obj.to.type = "LoginTable";
    obj.to.properties = {};
    obj.to.properties.name = "Admin";
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Permissions";
    obj.rel.return = false;
    app.nodeFunctions.changeRelation(obj, this, "checkAdminUser");
  }

  // If there are no real admins, create a temporary admin account with username and password of "admin".
  // If there ARE real admins, delete the temporary admin account if it exists.
  checkAdminUser(data) {
    if (data.length == 0) { // if no users are admins, create a temporary admin node if it doesn't exist...
      const obj = {};
      obj.name = "tempAdmin";
      obj.type = "tempAdmin";
      obj.properties = {};
      obj.properties.name = "Temporary Admin Account";
      obj.merge = true;
      app.nodeFunctions.createNode(obj, this, 'linkTempAdmin'); //... and call another function to link it to the admin table.
    }
    else { // if at least one user is an admin, delete the temporary admin node if it exists
      const obj = {};
      obj.type = "tempAdmin";
      obj.return = false;
      app.nodeFunctions.deleteNode(obj);
    }
  }

  linkTempAdmin(data) { // Link the temporary admin account to the Admin table, if it wasn't already linked.
    const id = data[0].tempAdmin.id;
    const obj = {};
    obj.from = {};
    obj.from.id = id;
    obj.from.return = false;
    obj.to = {};
    obj.to.type = "LoginTable";
    obj.to.properties = {};
    obj.to.properties.name = "Admin";
    obj.to.return = false;
    obj.rel = {};
    obj.rel.type = "Permissions";
    obj.rel.merge = true;
    obj.rel.properties = {};
    obj.rel.properties.username = "admin";
    obj.rel.properties.password = "admin";
    obj.rel.return = false;
    app.nodeFunctions.createRelation(obj);
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
      obj.from = {};
      obj.from.name = "user";
      obj.to = {};
      obj.to.name = "table";
      obj.to.type = "LoginTable";
      obj.rel = {};
      obj.rel.type = "Permissions";
      obj.rel.properties = {};
      obj.rel.properties.username = name;
      obj.rel.properties.password = password;
      obj.rel.return = false;
      app.nodeFunctions.changeRelation(obj, this, 'loginComplete');
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
      const loginButton = document.getElementById("loginButton");
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

     this.loginButton.setAttribute("value", "Log In");
     this.loginButton.setAttribute("onclick", "app.widget('login', this)");

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
