// This class handles everything to do with logging in and out of the website.
class widgetLogin {
  constructor() {
    this.requests = [];

    // DOM elements to be filled in later
    this.info = null; // Will show whether the user is logged in, and if so, their name and role
    this.sessionInfo = null;
    this.nameInput = null;
    this.passwordInput = null; // Just what they spund like - the inputs for the user's name and password.
    this.loginButton = null; // Button to click to log in

    // data to fill in when the user logs in - their ID, name and permissions level
    this.sessionGUID = null;
    this.browserGUID = null;
    this.requestCount = 0;
    this.userID = null;
    this.userGUID = null;
    this.userName = null; // the user's name in the DB
    this.userHandle = null; // the username the user chose for themselves
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
        app.login.sessionInfo = document.getElementById("sessionInfo");

        const widgetList = document.getElementById("headerList"); // Get the list of widgets
        const newEntry = document.createElement("li"); // Create an entry for the new widget
        widgetList.insertBefore(newEntry, widgetList.firstElementChild);

        // Set up the new widget's entry - it should describe the widget for now, and later we'll add listeners
        newEntry.outerHTML = `<li idr="loginDiv" onclick="app.clickWidgetEntry(this)" draggable="true"
        ondragstart="app.drag(this, event)" ondragover="event.preventDefault()" ondrop="app.drop(this, event)">
        Login widget</li>`;

        // Create debug and regression headers and link to debug and regression buttons in login header
        app.createDebug();
        // const headerExists = (document.getElementById("regressionHeader") !== null);
        if (document.getElementById("regressionHeader")) {
          app.regression.buildRegressionHeader();

          app.login.viewLoggedIn.push(document.getElementById('changeProfileButton'));
        }

        // The <p> containing the login fields is only visible when logged out
        app.login.viewLoggedOut.push(app.login.nameInput.parentElement);

        // The table of favorite nodes is only visible when logged in
        this.faveTable = document.getElementById("faveTable");
        app.login.viewLoggedIn.push(this.faveTable);
      }
    };

    xhttp.open("GET", "../widgetLogin.html");
    xhttp.send();
  }

  // Called when you hit a key while in the password box. If the key was "Enter", calls the login method.
  loginOnEnter(textBox, evnt) {
    if (textBox == this.passwordInput && evnt.key == "Enter") {
      this.login();
    }
  }

  login() {
    const dataObj = {"login":this, "app":app};
    this.tryLogin(dataObj)
    .then(function(dataObj) {
      this.sessionGUID = dataObj.data.sessionGUID;
      this.browserGUID = dataObj.data.browserGUID;
      if (dataObj.data.success === true) {
        this.loginComplete(dataObj);
        this.getMetaData(dataObj)
        .then(this.updateMetaData.bind(this));
        this.getFavorites(dataObj)
        .then(this.loadFavorites.bind(this));
      } // end if (login was successful)
    }.bind(this));
  }

  tryLogin(dataObj) {
    return new Promise(function(resolve, reject){
      dataObj.userRequest = dataObj.app.REST.startUserRequest("Login", dataObj.login.loginDiv);

      const obj = {"userName":dataObj.login.nameInput.value, "password":dataObj.login.passwordInput.value, "userRequest":dataObj.userRequest, "browserName":navigator.userAgent};
      if (dataObj.login.sessionGUID) {
        obj.sessionGUID = dataObj.login.sessionGUID;
      }
      if (dataObj.login.browserGUID) {
        obj.browserGUID = dataObj.login.browserGUID;
      }

    	const queryObject = {"server": "login", "function": "login", "query": obj};
    	const request = JSON.stringify(queryObject);

    	const xhttp = new XMLHttpRequest();

    	xhttp.onreadystatechange = function() {
    		if (this.readyState == 4 && this.status == 200) {
    			dataObj.data = JSON.parse(this.responseText);
          resolve(dataObj);
    		}
    	};

    	xhttp.open("POST", "");
    	xhttp.send(request);         // send request to server
    });
  }

  loginComplete(dataObj) {
    this.userName = dataObj.data.userName;
    this.userHandle = dataObj.handle;
    this.userID = dataObj.data.ID.low;
    this.userGUID = dataObj.data.GUID;
    this.permissions = dataObj.data.role;

    this.info.textContent = `Logged in as ${this.userName} -- Role: ${this.permissions}`;
    this.info.classList.add('loggedIn');
    this.sessionInfo.textContent = `Session GUID: ${this.sessionGUID}`;

    for (let i in this.viewLoggedIn) { // Show all items that are visible when logged in
      this.viewLoggedIn[i].classList.remove("hidden");
    }

    for (let i in this.viewLoggedOut) { // Hide all items that are visible when logged out
      this.viewLoggedOut[i].classList.add("hidden");
    }

    if (this.permissions == "Admin") { // If the user is an admin...
      for (let i in this.viewAdmin) { // show all items that are visible when logged in as an admin
        this.viewAdmin[i].classList.remove("hidden");
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

    // Turn login button into logout button
    this.loginButton.setAttribute("value", "Log Out");
    this.loginButton.setAttribute("onclick", "app.widget('logout', this)");

    // Add the search buttons, regression header and debug header to the widgets list
    const headerList = document.getElementById("headerList"); // Get the list of widgets
    const minList = document.getElementById("minimizedList");

    let newEntry = null;
    if (dataObj.login.permissions === "Admin") {
      newEntry = document.createElement("li");
      headerList.appendChild(newEntry);
      newEntry.outerHTML =
      `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
      ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="regressionHeader"
      class="hidden">Regression Testing</li>`;

      newEntry = document.createElement("li");
      minimizedList.appendChild(newEntry);
      newEntry.outerHTML =
      `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
      ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="regressionHeader">
      Regression Testing</li>`;

      newEntry = document.createElement("li");
      headerList.appendChild(newEntry);
      newEntry.outerHTML =
      `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
      ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="debugHeader"
      class="hidden">Debugging</li>`;

      newEntry = document.createElement("li");
      minimizedList.appendChild(newEntry);
      newEntry.outerHTML =
      `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
      ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="debugHeader">Debugging</li>`;
    }

    newEntry = document.createElement("li"); // Create an entry for the node search buttons
    headerList.appendChild(newEntry);

    // Set up the new widget's entry - it should describe the widget for now, and later we'll add listeners
    newEntry.outerHTML =
    `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
    ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="buttonsDiv">Node search buttons</li>`;
  }

  getMetaData(loginObj) {
    return new Promise(function(resolve, reject){
      // Get the metadata nodes, and search for any links between them and this user
      const obj = {};
      obj.required = {"type":"M_MetaData", "name":"metadata"};
      obj.rel = {"type":"Settings", "name":"settings", "direction":"left"};
      obj.optional = {"id":loginObj.login.userID, "return":false};

      loginObj.app.REST.sendQuery(obj, "findOptionalRelation", "Restoring metadata settings", loginObj.userRequest, loginObj.login.loginDiv, null, null, function(data){
        resolve(data);
      });
    }); // end promise constructor call
  }

  getFavorites(loginObj) {
    return new Promise(function(resolve, reject){
      const obj = {};
      obj.from = {"id":loginObj.login.userID};
      obj.rel = {"type":"Favorite", "return":false};
      obj.to = {};

      loginObj.app.REST.sendQuery(obj, "changeRelation", "Restoring favorites", loginObj.userRequest, loginObj.login.loginDiv, null, null, function(data) {
        resolve(data);
      });
    }); // end promise constructor call
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
  			if (app.metaData.node[name]) { // If a node metadata object exists with this type
  				app.updateObject(app.metaData.node[name], settings); // Bring in any fields which are in metadata but aren't in node
  				app.metaData.node[name] = settings; // Store the updated object in this.metaData
  			}
  			else if (app.metaData.relation[name]) { // If a relation metadata object exists with this type
  				app.updateObject(app.metaData.relation[name], settings); // Bring in any fields which are in metadata but aren't in relation
  				app.metaData.relation[name] = settings; // Store the updated object in this.metaData
  			}
      }

      if (app.metaData.node[name]) { // if this is metadata for a node, not a relation
        // Create a button for this nodeType
        const button = document.createElement('input');
        if (name.slice(0,2) === "M_") { // If this button represents a metadata node type, only admins should see it
          adminButtons.append(button);
        }
        else {
          buttons.append(button);
          app.userNodes.push({"db":name, "label":app.metaData.node[name].nodeLabel});
        }

        button.outerHTML = `<input type="button" value="${app.metaData.node[name].nodeLabel}" onclick="app.menuNodes('${name}')">`
      } // end if (this is metadata for a node)
    } // end for (each metadata node)
  }

  loadFavorites(data) {
    let GUIDs = null;
    if (data[0] && data[0].from.properties.M_favoriteGUIDs) {
     GUIDs = JSON.parse(data[0].from.properties.M_favoriteGUIDs);
    }
    const row = document.getElementById("faveNodes");
    if (GUIDs) { // Assuming the user has any ordered favorites stored
      for (let i = 0; i < GUIDs.length; i++) { // Go through all the ordered GUIDs the user stored
        const cell = row.lastElementChild; // The blank cell should be the last one since the user hasn't had a chance to rearrange yet
        // Get the data item with the given GUID, if any
        const fave = data.filter(node => app.getProp(node, "to", "properties", "M_GUID") == GUIDs[i]);
        if (fave.length == 1) { // If this item exists, add a cell for it...
          this.addFavoriteCell(row, cell, fave[0].to);

          // And remove the item from data
          const index = data.indexOf(fave[0]);
          delete data[index];
        }
      }
    }
    // Now if there are any unordered favorites (there shouldn't be, but there probably will be for some reason), put them at the end
    for (let i = 0; i < data.length; i++) {
      if (data[i]) {
        const cell = row.lastElementChild; // The blank cell should be the last one since the user hasn't had a chance to rearrange yet
        this.addFavoriteCell(row, cell, data[i].to);
      }
    }

    // Now turn the row into a dragdrop widget.
    row.parentElement.setAttribute("id", app.idCounter);
    row.parentElement.classList.add("widget");
    this.faveDragDrop = new dragDrop(row.getAttribute('idr'), null, 0, 0);
    this.faveDragDrop.saveFavorite = this.saveFavorite.bind(this);
    this.faveDragDrop.deleteFavorite = this.deleteFavorite.bind(this);
    // On drop, also update list of favorites GUIDs
    const oldDrop = this.faveDragDrop.drop;
    this.faveDragDrop.drop = function(input, evnt) {
      oldDrop.call(this, input, evnt);
      app.login.saveFavoritesList(); // Used for rearranging favorites, rather than adding new ones
    }
  }

  addFavoriteCell(row, cell, d) {
    // Get the user's label for this node type
    const DBType = d.labels[0];
    const label = app.metaData.getNode(DBType).nodeLabel;

    // Fill in data for this cell...
    cell.innerHTML = `<input type="button" value="X" onclick="app.widget('deleteFavorite', this); app.deleteLink(this)">
    <span onclick = "app.openNode('${DBType}', '${d.properties.M_GUID}')">${d.properties.name}:${label}</span>`;
    cell.setAttribute('GUID', d.properties.M_GUID);
    cell.setAttribute('name', d.properties.name);
    cell.setAttribute('type', DBType);
    cell.setAttribute('label', 'label')

    // Then create the next one
    const newCell = document.createElement("td");
    row.appendChild(newCell);
    newCell.outerHTML = `<td id="faveNode${app.faveNode++}" draggable="true"
                      ondragover = "event.preventDefault()" ondragstart="app.widget('drag', this, event)"
                      ondrop = "app.dropLink(this, event); app.widget('saveFavorite', this, event)"></td>`;
  }

  saveFavorite(input, evnt) {
    const dataText = evnt.dataTransfer.getData("text/plain");
    const data = JSON.parse(dataText);

    // If the data came from this table, we're rearranging, not adding a new favorite. Don't bother with the DB call
    if (data && data.sourceType == "dragDrop" && data.sourceTag == "TD" && data.sourceID == app.domFunctions.widgetGetId(input)) {
      return;
    }

    // Otherwise, verify that the data represent a node - if not, do nothing.
  	if (!data || !(
  			data.sourceType == "widgetTableNodes" && data.sourceTag == "TD" ||
  			data.sourceType == "widgetRelations" && data.sourceTag == "TR" ||
  			data.sourceType == "widgetNode" && data.sourceTag == "B" ||
  			data.sourceType == "dragDrop" && data.sourceTag == "TR" ||
  			data.sourceType == "widgetSVG" && data.sourceTag == "B"
  		)) {
  		return;
  	}

    // If we got this far, then the data represent a node which didn't come from the favorites list. Add a favorites relation.
    let userRequest = app.REST.startUserRequest("Save favorite", this.loginDiv);

    let obj = {};
    obj.from = {"id":this.userID, "return":false};
    obj.to = {"properties":{"M_GUID":data.nodeID}, "return":false};
    obj.rel = {"type":"Favorite", "merge":true, "return":false};

    app.REST.sendQuery(obj, "changeRelation", "Saving favorite", userRequest, this.loginDiv);
  }

  saveFavoritesList() {
    const row = document.getElementById("faveNodes");
    const cells = row.children;
    const GUIDs = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute("GUID")) { // If this cell has a GUID - meaning it's not blank
        GUIDs.push(cells[i].getAttribute("GUID"));
      }
    }

    let userRequest = app.REST.startUserRequest("Update favorites", this.loginDiv);

    const obj = {};
    obj.node = {"id":this.userID, "return":false};
    obj.changes = [{"property": "M_favoriteGUIDs", "value":app.stringEscape(JSON.stringify(GUIDs))}];

    app.REST.sendQuery(obj, "changeNode", "Updating favorites", userRequest, this.loginDiv);
  }

  deleteFavorite(element) { // element may be the TD cell itself or the delete button. It needs to be the TD cell.
    while (element.parentElement && element.tagName !== "TD") {
      element = element.parentElement;
    }

    let userRequest = app.REST.startUserRequest("Delete favorite", this.loginDiv);

    let obj = {};
    obj.from = {"id":this.userID, "return":false};
    obj.to = {"properties":{"M_GUID":element.getAttribute("GUID")}, "return":false};
    obj.rel = {"type":"Favorite", "return":false};

    app.REST.sendQuery(obj, "deleteRelation", "Deleting favorite", userRequest, this.loginDiv);
  }

  checkUserName(input) {
    let userRequest = app.REST.startUserRequest("Check username availability", this.loginDiv);

    const obj = {};
    obj.rel = {"type":"Permissions", "properties":{"username":input.value}};
    obj.to = {"return":false};
    obj.from = {"return":false};

    app.REST.sendQuery(obj, "changeRelation", "Checking username availability", userRequest, this.loginDiv, null, null, function(data, userRequest, input) {
      if (data.length > 0) {
        alert ("That username is taken; please choose another.");
        input.value = "";
      }
    }.bind(this), input);
  }

  checkPassword(input) {
    return; // for now, no restrictions on passwords - will add later
  }

  changeProfile(button) {
    const popup = document.getElementById('profilePopup');
    popup.hidden = false;
    const bounds = button.getBoundingClientRect();
    popup.setAttribute("style", `left:${bounds.left + window.scrollX}px; top:${bounds.top + window.scrollY}px`);
    const nameInput = app.domFunctions.getChildByIdr(popup, 'name');
    nameInput.value = this.userHandle;
    const pwInput = app.domFunctions.getChildByIdr(popup, 'password');
    pwInput.value = ""; // For now, NOT going to show the original password, even masked
  }

  profilePopupOK(button) {
    const popup = document.getElementById('profilePopup');
    const nameInput = app.domFunctions.getChildByIdr(popup, 'name');
    const pwInput = app.domFunctions.getChildByIdr(popup, 'password');

    let userRequest = app.REST.startUserRequest("Save profile", this.loginDiv);

    const obj = {};
    obj.from = {"id":app.login.userID, "return":false};
    obj.rel = {"type":"Permissions", "return":false};
    obj.to = {"type":"M_LoginTable", "properties":{"name":this.permissions}, "return":false};
    obj.changes = [];
    if (nameInput.value) {
      this.userHandle = nameInput.value;
      obj.changes.push({"item":"rel", "property":"username", "value":app.stringEscape(nameInput.value)});
    }
    if (pwInput.value) {
      obj.changes.push({"item":"rel", "property":"password", "value":app.stringEscape(pwInput.value)});
    }

    app.REST.sendQuery(obj, "changeRelation", "Updating profile", userRequest, this.loginDiv);

    popup.hidden = true;
  }

  profilePopupCancel(button) {
    const popup = document.getElementById('profilePopup');
    popup.hidden = true;
  }

  // Logs the user out: resets login information to null, resets the info paragraph to say "not logged in",
  // then hides/reveals items and calls methods as appropriate on logout.
  logout() {
    for (let i in this.viewLoggedOut) { // Show all items that are visible when logged out
      this.viewLoggedOut[i].classList.remove("hidden");
    }

    for (let i in this.viewLoggedIn) { // Hide all items that are visible when logged in
      this.viewLoggedIn[i].classList.add("hidden");
    }

    for (let i in this.viewAdmin) { // Hide all items that are visible when logged in as an admin
      this.viewAdmin[i].classList.add("hidden");
    }

    for (let i in this.doOnLogout) { // Run all methods that run when a user logs out
      const object = this.doOnLogout[i].object;
      const method = this.doOnLogout[i].method;
      const args = this.doOnLogout[i].args;
      object[method](...args);
    }

    // Clear favorites
    const faveRow = document.getElementById("faveNodes");
    faveRow.innerHTML = `
            <td id="faveNodes">Favorite Nodes (Shortcuts):</td>
            <td id="faveNode0"
              ondragover = "event.preventDefault()"
              ondrop = "app.dropLink(this, event); app.widget('saveFavorite', this)">
            </td>`;
    app.faveNode = 1;

    this.loginButton.setAttribute("value", "Log In");
    this.loginButton.setAttribute("onclick", "app.widget('login', this)");

    this.userID = null; // Log the user out
    this.userGUID = null;
    this.userName = null;
    this.permissions = null;
    this.info.textContent = `Not Logged In`;
    this.info.classList.remove("loggedIn");
    this.sessionInfo.textContent = '';

    this.nameInput.value = "";
    this.passwordInput.value = "";


    const userRequest = app.REST.startUserRequest("Logout", this.loginDiv);

    const obj = {"userRequest":userRequest, "sessionGUID":this.sessionGUID, "browserGUID":this.browserGUID};

    const queryObject = {"server": "login", "function": "logout", "query": obj};
    const request = JSON.stringify(queryObject);

    const xhttp = new XMLHttpRequest();

    xhttp.open("POST", "");
    xhttp.send(request);         // send request to server
  }
}
