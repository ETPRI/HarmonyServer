// import "module-name";
// import('./widgetList.js');
// import does not work yet, just include modules in index.js in "correct order"

// app.js holds the global functions and data for the application

class appClass { ///////////////////////////////////////////////////////////////// start class

// called once by app.html to create the one instance
constructor() {
	this.widgets   = {}; // store widgets as they are created, remove when closed
	this.idCounter = 0;  // init id counter - used get getElementById, is the id of the widget

	this.activeWidget 	= null; // widget being dragged
	this.shownTable 		= null; // visible table widget

	this.metaData  			= null;
	this.domFunctions 	= null;
	this.login 					= null;
	this.regression 		= null;
	this.checkEmpty 		= null;

	this.workSpace			= null;
	this.tableHeader		= null;
	this.adminButtons		= null;

	this.userNodes			= [];

	this.dropNode				= 1;
	this.faveNode 			= 1;

	this.doOnResize			= [];

	window.onerror = function(msg, url, line, col, err) {
		app.error(msg, err);
	};
}

// Calls all the functions which need to run at the start of a session.
buildApp() {
	// Create instances of other classes needed to run the page. Called here because some of them require app to exist
	// before their constructors can run.
	this.metaData  			= new metaData();
	this.domFunctions 	= new domFunctions();
	this.login 					= new widgetLogin();
	this.regression 		= new regressionTesting();
	this.checkEmpty 		= new checkEmpty();
	this.REST						= new REST();

	// Add the regression header and login div to the list of widgets
	this.widgets.regressionHeader = this.regression;
	this.widgets.loginDiv = this.login;

	// Make the workspace and table header visible only when a user is logged in, and remove all widgets when the user logs out.
	this.workSpace = document.getElementById("workSpace");
	this.workSpace.classList.add("hidden");
	this.login.viewLoggedIn.push(this.workSpace);
	this.tableHeader = document.getElementById("tableHeader");
	this.tableHeader.classList.add("hidden");
	this.login.viewLoggedIn.push(this.tableHeader);
	this.adminButtons = document.getElementById("adminButtons");
	this.login.viewAdmin.push(this.adminButtons);
	this.buttonsDiv = document.getElementById("buttonsDiv");
	this.login.viewLoggedIn.push(this.buttonsDiv);

	document.addEventListener("keydown", this.keyPressed.bind(this));

	// Check for metadata and add it if needed
	this.checkMetaData();

	// Run any test code currently in app
	this.test();
}

checkMetaData() {
	const obj = {};
	obj.node = {"type":"M_MetaData"};

	this.sendQuery(obj, "changeNode", "Looking for metadata nodes", null, null, null, this.addMetaData.bind(this));
}

addMetaData(data) { // data should be all metadata nodes, for both nodes and relations
	if (!data || data.length == 0) { // If no metadata nodes were found, add them.
		let type;
		for (type in this.metaData.node) { // Add all node metadata...
			const obj = {"type":"M_MetaData", "properties":{"name":type}, "return":false};
			obj.properties.nodeLabel = this.stringEscape(JSON.stringify(this.metaData.node[type].nodeLabel));
			obj.properties.orderBy = this.stringEscape(JSON.stringify(this.metaData.node[type].orderBy));
			obj.properties.fields = this.stringEscape(JSON.stringify(this.metaData.node[type].fields));
			obj.properties.fieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].fieldsDisplayed));
			obj.properties.formFieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].formFieldsDisplayed));

			this.sendQuery(obj, "createNode", `Adding metadata node ${type}`);
		}

		for (type in this.metaData.relation) { // and all relation metadata
			const obj = {"type":"M_MetaData", "properties":{"name":type}, "return":false};
			obj.properties.relLabel = this.stringEscape(JSON.stringify(this.metaData.relation[type].relLabel));
			obj.properties.orderBy = this.stringEscape(JSON.stringify(this.metaData.relation[type].orderBy));
			obj.properties.fields = this.stringEscape(JSON.stringify(this.metaData.relation[type].fields));
			obj.properties.fieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.relation[type].fieldsDisplayed));

			this.sendQuery(obj, "createNode", `Adding metadata node ${type}`);
		}
	} // end if (no data were returned; no metadata nodes were found)

	else {
		// if data were found, it will be an array of metadata nodes. For every metadata node that was found,
		// update this.metaData.node to reflect it. Then for every item in this.metaData.node for which
		// a metadata node was NOT found, create one.
		for (let i = 0; i < data.length; i++) {
			const node = data[i].node.properties;
			const name = node.name;
			delete node.name;
			delete node.M_GUID; // All properties other than these two should be stored in app.metaData

			// parse all properties
			for (let prop in node) {
				node[prop] = JSON.parse(node[prop]);
			}

			let updated = false;
			if (this.metaData.node[name]) { // If a node metadata object exists with this type
				updated = this.updateObject(this.metaData.node[name], node); // Bring in any fields which are in metadata but aren't in node
				this.metaData.node[name] = node; // Store the updated object in this.metaData
			}
			else if (this.metaData.relation[name]) { // If a relation metadata object exists with this type
				updated = this.updateObject(this.metaData.relation[name], node); // Bring in any fields which are in metadata but aren't in relation
				this.metaData.relation[name] = node; // Store the updated object in this.metaData
			}

			if (updated) { // If anything was added to the DB node from the metadata class, save the updated DB node
				const obj = {};
				obj.node = {"type":"M_MetaData", "properties":{"name":name}, "return":false};

			  if (this.metaData.node[name]) { // If this metadata object represents a node
					obj.changes = [{"property":"nodeLabel", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].nodeLabel))}
												,{"property":"orderBy", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].orderBy))}
												,{"property":"fields", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].fields))}
												,{"property":"fieldsDisplayed", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].fieldsDisplayed))}
												,{"property":"formFieldsDisplayed", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].formFieldsDisplayed))}];
				}

				else { // If the node was updated, it MUST have matched either a node or relation object. If it's not a node it must be a relation.
					obj.changes = [{"property":"nodeLabel", "value":this.stringEscape(JSON.stringify(this.metaData.relation[name].relLabel))}
												,{"property":"orderBy", "value":this.stringEscape(JSON.stringify(this.metaData.relation[name].orderBy))}
												,{"property":"fields", "value":this.stringEscape(JSON.stringify(this.metaData.relation[name].fields))}
												,{"property":"fieldsDisplayed", "value":this.stringEscape(JSON.stringify(this.metaData.relation[name].fieldsDisplayed))}];
				}

				this.sendQuery(obj, "changeNode", `Updating metadata node ${name}`);
			}
			node.name = name; // put the name back for the next step
		} // end for (every metadata node that was found)

		let type;
		for (type in this.metaData.node) { // for every entry in this.metaData.node...
			let DBNode = data.find(x => x.node.properties.name === type); // look for a matching DB metadata node.
			if (!DBNode) { // If there is no such node, create one.
				const obj = {"type":"M_MetaData", "properties":{"name":type}, "return":false};
				obj.properties.nodeLabel = this.stringEscape(JSON.stringify(this.metaData.node[type].nodeLabel));
				obj.properties.orderBy = this.stringEscape(JSON.stringify(this.metaData.node[type].orderBy));
				obj.properties.fields = this.stringEscape(JSON.stringify(this.metaData.node[type].fields));
				obj.properties.fieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].fieldsDisplayed));
				obj.properties.formFieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].formFieldsDisplayed));

				this.sendQuery(obj, "createNode", `Adding metadata node ${type}`);
			}
		}

		for (type in this.metaData.relation) { // for every entry in this.metaData.relation...
			let DBNode = data.find(x => x.node.properties.name === type); // look for a matching DB metadata node.
			if (!DBNode) { // If there is no such node, create one.
				const obj = {"type":"M_MetaData", "properties":{"name":type}, "return":false};
				obj.properties.relLabel = this.stringEscape(JSON.stringify(this.metaData.relation[type].relLabel));
				obj.properties.orderBy = this.stringEscape(JSON.stringify(this.metaData.relation[type].orderBy));
				obj.properties.fields = this.stringEscape(JSON.stringify(this.metaData.relation[type].fields));
				obj.properties.fieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.relation[type].fieldsDisplayed));

				this.sendQuery(obj, "createNode", `Adding metadata node ${type}`);
			}
		}
	}
}

updateObject(copyFrom, copyTo) {
	let updated = false; // becomes true if copyTo changes
	const fromKeys = Object.keys(copyFrom);
	for (let i = 0; i < fromKeys.length; i++) {
		const key = fromKeys[i];
		if (!(key in copyTo)) {
			copyTo[key] = copyFrom[key]; // If this attribute wasn't in copyTo, add it
			updated = true;
		}
		// If this attribute is itself an object, call updateObject recursively to add any fields which from has and to doesn't
		else if (typeof copyTo[key] === 'object' && !(Array.isArray(copyTo[key])) && typeof copyFrom[key] === 'object' && !(Array.isArray(copyFrom[key]))) {
			const recursiveUpdate = this.updateObject(copyFrom[key], copyTo[key]);
			updated = (updated || recursiveUpdate); // updated stays true if it was true; otherwise takes the return value
		}
	}
	return updated;
}

keyPressed(evnt) {
	if (this.activeWidget) {
		const widgetID = this.activeWidget.getAttribute("id");
		const widgetObj = this.widgets[widgetID];
		if (widgetObj && widgetObj.keyPressed) {
			widgetObj.keyPressed(evnt);
		}
	}
}

// Removes all widgets other than the login div and regression header from both the screen and the widgets array
// To add: Also clear the widget list of everything except the login widget, and minimize the debug and regression headers
clearWidgets() {
	const login = document.getElementById('loginDiv');
	const regHeader = document.getElementById('regressionHeader');
	for (let id in this.widgets) { // For every widget...
		if (id != "loginDiv" && id != "regressionHeader") { // (except for the login div and regression header)...

			// delete  html2 from page
			const widget = document.getElementById(id);
			if (widget && !(login.contains(widget)) && !(regHeader.contains(widget))) {
				widget.parentElement.removeChild(widget);
			}

			// Remove widget objects
			if (!widget || (!(login.contains(widget)) && !(regHeader.contains(widget)))) {
				delete this.widgets[id];
			}
		}
	}

	// Remove all items other than login widget from the widgets list
	const headerList = document.getElementById("headerList");
	const widgetList = document.getElementById("widgetList");
	const minimizedList = document.getElementById("minimizedList");
	headerList.innerHTML = `<li idr="loginDiv">Login widget</li>`;
	widgetList.innerHTML = "";
	minimizedList.innerHTML = "";

	// Hide debug and regression widgets
	const debug = document.getElementById("debugHeader");
	const regression = document.getElementById("regressionHeader");
	debug.classList.add("hidden");
	regression.classList.add("hidden");
}

// Takes a DOM element inside a widget, a method, and a set of arguments for that method.
// Finds the widget OBJECT associated with the widget that the DOM element is inside,
// then calls that method, belonging to that widget, with the original DOM element as the first argument,
// and the list of args as the remaining arguments
widget(method, widgetElement, ...args) { // args takes all the remaining arguments and stores them in an array
	// Get the ID of the widget that the DOM element is inside.
	const id = this.domFunctions.widgetGetId(widgetElement);

	// If that ID is associated with a widget object which contains the given method...
	if (id && this.widgets[id] && this.widgets[id][method]) {
		this.widgets[id][method](widgetElement, ...args); //  Call the method, and pass in widgetElement and any extra args
	} else {
     // Create an error message. This could stand to be more informative, but I'm not sure how best to write it.
		 this.error(`App.widget: method ${method} in widget #${id} could not be called.`);
	}
}

// Creates all the debugging features (metaData dropdown, log button, display for DB queries, etc.) in the debug header.
createDebug() {
	const tempID = app.idCounter;

	let header = document.getElementById("debugHeader");
	if (header) {
		header.outerHTML = this.widgetHeader('Debug Menu', 'div') + `
			<b>Debugging</b></span>
			<input type="button" class="hidden" idr="cancelButton" value="Cancel" onclick="app.stopProgress(this)"></div>
			<div class="widgetBody freezable">
				<select id="metaData" onchange="app.menuDBstats(this); this.selectedIndex = 0">
					<option value="">MetaData</option>
					<option value="nodes">Nodes</option>
					<option value="keysNode">Node Keys</option>
					<option value="relations">Relations</option>
					<option value="keysRelation">Relation Keys</option>
					<option value="dataBrowser">Data Browser</option>
					<option value="sync">Sync with remote server</option>
				</select>
				<input type="button" id="LogButton" value="Start Logging" onclick="app.regression.logToggle(this)">
				<input type="button" id="Clear" value="Clear ALL" onclick="app.regression.clearAll(app)">
				<input type="button" id="checkEmpty" value="Check whether database is empty" onclick="app.checkEmpty.checkEmpty(this)">
				Most recent DB query: <input type="text" size="80">
				<p>
					<a href="http://localhost:7474/browser/" target="_blank">Neo4j Browser</a>
					To use this site, Neo4j Desktop must be running with a database started.
				</p><hr></div></div>	`;

		header = document.getElementById(tempID);
		header.classList.add('hidden');
		header.setAttribute('id', 'debugHeader');
		app.domFunctions.getChildByIdr(header, 'closeButton').classList.add("hidden"); // Hide the close button


		// For now, SHOULD be OK that there is no actual JS object associated with this widget -
		// if it causes trouble later, I'll create a debug class. Maybe merge it with WTQ.

		// const obj = {};
		// obj.object = this;
		// obj.method = 'hideDebug';
		// const debugButton = document.getElementById('debugButton');
		// obj.args = [debugButton];
		// this.login.doOnLogout.push(obj);
	}
}

// Runs when a search button is clicked. Shows the table associated with that search button. Criteria is an array of objects representing search criteria.
menuNodes(name, criteria) {
	// Add the new table at the bottom of the "header widgets" section if there wasn't a table open already,
	// or in the place of the existing open table if there was one
	let toReplace = null;
	let headerList = document.getElementById("headerList");
	if (this.shownTable) {
		const replaceID = this.shownTable.getAttribute("id");
		toReplace = this.domFunctions.getChildByIdr(headerList, replaceID);
	}

	if (toReplace) { // If there was another table already shown, and it had an entry in the widget list
		toReplace.outerHTML = `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
		ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="${name}" class="tableEntry">Table of ${name} nodes</li>`;
	}

	else {
		let newEntry = document.createElement('li');
		headerList.appendChild(newEntry);
		newEntry.outerHTML = `<li onclick="app.clickWidgetEntry(this)" draggable="true" ondragstart="app.drag(this, event)"
		ondragover="event.preventDefault()" ondrop="app.drop(this, event)" idr="${name}" class="tableEntry">Table of ${name} nodes</li>`;
	}

	// Hide the shown table, if any
	if (this.shownTable) {
		this.shownTable.classList.add("hidden");
		this.shownTable = null;
	}

	// Create the required table, if it didn't already exist
	if (!(this.widgets[name])) {
		this.widgets[name] = new widgetTableNodes(name, null);
	}

	// If there was already a table shown in the minimized widgets list, remove it
	const minimizedList = document.getElementById("minimizedList");
	const tableEntries = minimizedList.getElementsByClassName("tableEntry"); // should be at most one, but may as well loop through just in case
	for (let i = 0; i < tableEntries.length; i++) {
		minimizedList.removeChild(tableEntries[i]);
	}

	// Show the required table
	let newTable = document.getElementById(name);
	if (newTable) {
		newTable.classList.remove("hidden");
		this.shownTable = newTable;
		let newTableJS = this.widgets[name];
	}

	// Search using the passed-in criteria, if any were passed in
	if (criteria) {
		this.widgets[name].search(criteria);
	}
}

// displays meta-data on nodes, keysNodes, relations, and keysRelations
// Also creates databrowsers to explore the DB and allows syncing with a remote DB.
menuDBstats(dropDown){
	// Get the value from the metadata dropdown.
	const value = dropDown.options[dropDown.selectedIndex].value;
	// If the value is blank (placeholder is selected) do nothing; else create a new widgetTableQuery and store in this.widgets.
	if (value==="") return;

	else if (value ==="dataBrowser") {
		new dataBrowser();
	}

	else if (value === "sync") {
		new sync();
	}

	else {
		this.widgets[this.idCounter] = new widgetTableQuery(value, dropDown.id);
	}
}

// refresh widget with new database call. domElement is the search button that triggered the search.
widgetSearch(domElement) {
	// Get the ID of the widget that the search button was part of...
	const id = this.domFunctions.widgetGetId(domElement);
	this.widgets[id].searchTrigger = id;
	// then call that widget's search function.
	this.widgets[id].search();
}

// Returns HTML for a widget header, including an outer element to hold the entire widget
// (a div, unless something else is specified), an inner header div,
// and working close and expand/collapse buttons inside the header.
// Gives the widget an ID as specified by this.idCounter, and increments this.idCounter.
// Also gives the whole widget an ondrop and ondragover so that widgets can be dragged onto each other to rearrange them,
// and gives the header an ondragstart so that widget headers, and only the headers, can be dragged in this way.
// Places the buttons in a span with class "freezable" so that they can be frozen while a request runs.
// Does not close the span, header div or outer element.
widgetHeader(widgetType, tag){
	if (!tag) {
		tag = "div";
	}
	return(`
	<${tag} id="${this.idCounter++}" class="widget fullWidth" onmousedown="app.setActiveWidget(this)">
	<hr>
	<div idr="header" class="widgetHeader">
		<span class="freezable">
			<div idr="requestDetails" class="hidden"></div>
			<input type="button" value="X" idr="closeButton" onclick="app.widgetClose(this)">
			<input type="button" value="__" idr="expandCollapseButton" onclick="app.widgetCollapse(this)">
			<input type="button" value = "<>" idr="fullScreenButton" onclick = "app.widgetFullScreen(this)">
			<input type="button" value="?" idr="helpButton" onclick="app.showHelp('${widgetType}', app.domFunctions.widgetGetId(this))">
			Last action: <span idr="requestName">None</span><input type="button" class="hidden" value="+" idr="showRequestDetails" onclick="app.toggleRequestDetails(this)"><br>
		`)
}

// Expands or collapses a widget when the expand/collapse button in that widget is clicked.
// Also changes the text on the button back and forth between "__" and "+".
// Currently, assumes that the expand/collapse button is in the header, which is in the widget div
// (it is thus the grandchild of the widget div), which should always be true because all widget headers
// are made the same way by the same function. Also assumes that the widget body - the part to expand or
// collapse - is a child of the widget div and has the class "widgetBody".
widgetCollapse(domElement) {
	// If the widget was full-screen, shrink it
	let fullScreen = this.domFunctions.getChildByIdr(domElement.parentElement, "fullScreenButton");
	if (fullScreen && fullScreen.value === "><") {
		this.widgetFullScreen(fullScreen);
	}

	// parent = span grandparent = header great-grandparent = widget
	const widgetID = this.domFunctions.widgetGetId(domElement);
	const widget = document.getElementById(widgetID);
	const children = Array.from(widget.children);

	// Here is where the widget is actually hidden or shown
	if (widget) {
		// Get the ID of the widget
		const widgetID = this.domFunctions.widgetGetId(domElement);
		const minList = document.getElementById("minimizedList");
		const allLists = document.getElementById("widgetLists");

		widget.classList.toggle("hidden");
		if(widget.classList.contains("hidden")) {
			domElement.value = "+";

			// Add this widget to the minimized list and hide its entry in the main or header list
			const mainEntry = this.domFunctions.getChildByIdr(allLists, widgetID); // Find the entry that already exists
			const minimizedEntry = document.createElement("li"); // Create a new entry and add it to the minimized list
			minList.appendChild(minimizedEntry);
			minimizedEntry.outerHTML = mainEntry.outerHTML; // Make the new entry a copy of the old one
			mainEntry.classList.add("hidden"); // Hide the original
		} else {
			domElement.value = 	"__";

			// Remove this widget from the minimized list and show its entry in the main or header list
			const minimizedEntry = this.domFunctions.getChildByIdr(minList, widgetID); // Find the entry in the minimized list
			minList.removeChild(minimizedEntry);
			const mainEntry = this.domFunctions.getChildByIdr(allLists, widgetID); // Find the original entry in the main list
			mainEntry.classList.remove("hidden"); // Show the original
		}
	}

	// log
	const obj = {};
	obj.id = this.domFunctions.widgetGetId(domElement);
	obj.idr = domElement.getAttribute('idr');
	obj.action = "click";
	this.regression.log(JSON.stringify(obj));
	this.regression.record(obj);
}

// Called when a close button is clicked. widgetElement is the close button.
// Removes the widget that widgetElement is part of from the screen,
// and removes it and all widgets contained in it from this.widgets array.
// Relies on widgets which contain other widgets maintaining a list of contained widgets.
widgetClose(widgetElement) {
	// If the widget was full-screen, shrink it
	let fullScreen = this.domFunctions.getChildByIdr(widgetElement.parentElement, "fullScreenButton");
	if (fullScreen && fullScreen.value === "><") {
		this.widgetFullScreen(fullScreen);
	}

	// Get the ID and DOM element of the widget to be closed
	const id = this.domFunctions.widgetGetId(widgetElement);
	const widget = document.getElementById(id);

	// If the widget to "close" is a table widget, just hide it and remove it from the widget list.
	if (widget.classList.contains('tableWidget')) {
		widget.classList.add('hidden');
		this.shownTable = null;

		// Remove widget from header widget list on page
		const widgetList = document.getElementById("headerList");
		const entry = app.domFunctions.getChildByIdr(widgetList, id);
		if (entry) {
			widgetList.removeChild(entry);
		}
	}

	else { // otherwise, actually delete it
		// delete javascript instance of widgetTable
		let children = [];
		if (this.widgets[id] && this.widgets[id].containedWidgets) { // Get the IDs of all widgets contained within this one.
			children = children.concat(this.widgets[id].containedWidgets)
		}
		delete this.widgets[id]; // Delete the original widget.

		while (children.length >0) {
			const child = children.pop(); // Grab a child widget...
			const widget = this.widgets[child];
			if (widget.containedWidgets) { // Get the IDs of all widgets contained within it...
				children = children.concat(widget.containedWidgets);
			}
			delete this.widgets[child]; 	// and delete it.
		}

		this.activeWidget = null;

		// delete html2 from page
		widget.parentElement.removeChild(widget);

		// Remove widget from widget list on page
		const widgetList = document.getElementById("widgetList");
		const entry = app.domFunctions.getChildByIdr(widgetList, id);
		if (entry) {
			widgetList.removeChild(entry);
		}
	}

	// log
	const obj = {};
	obj.id = id;
	obj.idr = widgetElement.getAttribute("idr");
	obj.action = "click";
	this.regression.log(JSON.stringify(obj));
	this.regression.record(obj);
}

widgetFullScreen(widgetElement) {
	const widget = widgetElement.parentElement.parentElement; // parent element is header; grandparent is whole widget

	if (widgetElement.value === "<>") {
		// Hide all elements on the screen except for the widget. Start with all children of the body, except the widget or its descendant...
		let ancestor = document.body;
		while (ancestor !== null) { // Keep going as long as an ancestor of the desired widget was found...
			const children = ancestor.children;
			ancestor = null;	// Resets the ancestor to either null...

			for (let i = 0; i < children.length; i++) {
				if (children[i].contains(widget) && !(children[i] === widget)) {
					ancestor = children[i];	// or the next-lower ancestor
				}
				else if (children[i] !== widget) {
					children[i].classList.add("hiddenForFS"); // Hides every node that ISN'T either the widget or its ancestor
				}
			} // end for (all the ancestor's children)
		} // end while (an ancestor was found)

		widget.classList.add("fullScreen");

		const id = widget.id;
		const JSwidget = this.widgets[id];
		if (JSwidget.constructor === widgetSVG) { // If this is a mindmap
			let element = JSwidget.SVG_DOM;
			while (!(element.classList.contains('fullScreen'))) {
				element.classList.add('fullHeight'); // make the SVG and all its ancestors full height
				element = element.parentElement;
			}
		}

		widgetElement.value = "><";
	}
	else if (widgetElement.value === "><") {
		// Show all previously hidden elements on the screen
		const hidden = document.getElementsByClassName('hiddenForFS');
		while (hidden.length > 0) {
			hidden[0].classList.remove("hiddenForFS");
		}

		const id = widget.id;
		const JSwidget = this.widgets[id];
		if (JSwidget.constructor === widgetSVG) { // If this is a mindmap
			let element = JSwidget.SVG_DOM;
			while (!(element.classList.contains('fullScreen'))) {
				element.classList.remove('fullHeight'); // make the SVG and all its ancestors full height
				element = element.parentElement;
			}
		}

		widget.classList.remove("fullScreen");

		widgetElement.value = "<>";
	}
	else {
		this.error("Widget fullscreen button's value is not <> or ><");
	}
}

toggleRequestDetails(button) { // The toggle button should be a sibling of the request details div
	const header = button.parentElement;
	const detailsDiv = this.domFunctions.getChildByIdr(header, 'requestDetails');

	if (button.value === '+') {
		detailsDiv.classList.remove("hidden");
		button.value = "__";
	}
	else if (button.value === "__") {
		detailsDiv.classList.add("hidden");
		button.value = "+";
	}
	else {
		app.error(`Toggle details button should display "+" or "__", but instead displays "${button.value}"`);
	}
}

// Escapes special characters in a string. Stringifying it and then removing the outer quotes is a good shortcut.
stringEscape(text) {
	let string = JSON.stringify(text);
	string = string.substring(1, string.length-1);
	return string;
}

// Removes the ID of every node and relation, including node IDs stored IN a relation as "start" and "end" values.
// Useful before recording for regression testing, because IDs are not consistent from playthrough to playthrough,
// so recording them means it's impossible to compare the results of two playthroughs and see if they're equal.
stripIDs (data) { // Assume that the data is the result of a query. Each row may include a node or relation whose IDs, start and end attributes need to be stripped.
	for (let i = 0; i < data.length; i++) { // for every row returned, which may include whole nodes or relations with any name
		for (let fieldName in data[i]) { // for every item in that row, which may BE a whole node or relation
			if ((data[i][fieldName] instanceof Object) && ('identity' in data[i][fieldName])) { // If that item is an object with an identity, delete it
				delete data[i][fieldName].identity;
			}
			if ((data[i][fieldName] instanceof Object) && ('id' in data[i][fieldName])) { // If that item is an object with an id (new alias for identity), delete it
				delete data[i][fieldName].id;
			}
			if ((data[i][fieldName] instanceof Object) && ('start' in data[i][fieldName])) { // If that item has a "start", which is another node's identity, delete it
				delete data[i][fieldName].start;
			}
			if ((data[i][fieldName] instanceof Object) && ('end' in data[i][fieldName])) { // If that item has an "end", which is another node's identity, delete it
				delete data[i][fieldName].end;
			}
		}
	} // end for (every row)
}

// Called when the user clicks and drags a widget. Sets this.activeWidget (which records which widget, if any, is being dragged)
// to the widget that was clicked. Also stores information about the widget being dragged in dataTransfer.
drag(entry, evnt) {
	this.activeWidget = null; // No widget is selected - at least, unless/until I make the widgets list a widget itself
	this.draggingEntry = entry; // whatever item is being dragged

	// Stores information about the item being dragged in dataTransfer - the fact that the source was a list entry, the tagname of "li", and the ID of the parent list
	const data = {};
	data.sourceType = "listEntry";
	data.sourceTag = entry.tagName;
	data.parentID = entry.parentElement.getAttribute("id");
	evnt.dataTransfer.setData("text/plain", JSON.stringify(data));
}

// Prevents the default action of a drop so that we can write our own ondrop methods.
allowDrop(input, evnt) {
	evnt.preventDefault();
}

// Used for rearranging. When something is dropped onto a widget, check to verify that it's another widget,
// then insert the widget that was dragged above (if dragging up) or below (if dragging down) the one it was dropped onto.
drop(entry, evnt) {
	evnt.preventDefault();

	// Get the data about the object being dragged
	const dataText = evnt.dataTransfer.getData("text/plain");
	let data = {};
	if (dataText) {
	  data = JSON.parse(dataText);
	}

	// Make sure the object being dragged is an entry from the same list as the target
	if (data.sourceType == "listEntry" && data.parentID === entry.parentElement.getAttribute("id") && this.draggingEntry) {
		let tableDiv = document.getElementById("tableHeader");

		let target = evnt.target;
		let targetID = target.getAttribute("idr");
		let targetWidget = document.getElementById(targetID);
		if (targetWidget.parentElement === tableDiv) {
			targetWidget = tableDiv; // if dropping onto a WTN, treat the whole table div as the target
		}
		let source = this.draggingEntry;
		let sourceID = source.getAttribute("idr");
		let sourceWidget = document.getElementById(sourceID);
		if (sourceWidget.parentElement === tableDiv) {
			sourceWidget = tableDiv; // if dragging a WTN, move the whole table div
		}

		if (source.offsetTop < target.offsetTop) {  // drag down
			target.parentNode.insertBefore(source, target.nextSibling); // Insert after target
			targetWidget.parentNode.insertBefore(sourceWidget, targetWidget.nextSibling); // Insert after target widget
		}
		else { // drag up
			target.parentNode.insertBefore(source, target); // Insert before target
			targetWidget.parentNode.insertBefore(sourceWidget, targetWidget); // Insert before target widget
		}

		this.draggingEntry = null; // Nothing is actively being dragged anymore - the thing that was being dragged was dropped.
	}
}

setActiveWidget(widget) {
	if (this.activeWidget) {
		this.activeWidget.classList.remove("activeWidget");
	}
	this.activeWidget = widget;
	widget.classList.add("activeWidget");
}

dropLink(input, evnt) {
	const dataText = evnt.dataTransfer.getData("text/plain");
	const data = JSON.parse(dataText);

	// If this came from a draggable TD in the same widget, it should be from rearranging tds in a draggable row.
	// Call dragdrop.drop to handle it.
	if (data && data.sourceType == "dragDrop" && data.sourceTag == "TD" && data.sourceID == this.domFunctions.widgetGetId(input)) {
		this.widget('drop', input, evnt);
		return;
	}

	// Otherwise, verify that the data represent a node
	else if (!data || !(
			data.sourceType == "widgetTableNodes" && data.sourceTag == "TD" ||
			data.sourceType == "widgetRelations" && data.sourceTag == "TR" ||
			data.sourceType == "widgetNode" && data.sourceTag == "B" ||
			data.sourceType == "dragDrop" && data.sourceTag == "TR" ||
			data.sourceType == "widgetSVG" && data.sourceTag == "B"
		)) {
		return;
	}

	// Figure out which type of cell this was dropped into - for now, choices are dropNode and faveNode
	const name = input.getAttribute("id").slice(0,8); // dropNode or faveNode - have to tweak this logic if I ever have a choice without 8 chars
	let dropCode = "app.dropLink(this, event)";
	let deleteCode = "app.deleteLink(this)";
	let dragCode = "";
	if (name === "faveNode") {
		dropCode += "; app.widget('saveFavorite', this, event)";
		deleteCode = `app.widget('deleteFavorite', this); ${deleteCode}`;
		dragCode = `draggable="true" ondragstart="app.widget('drag', this, event)"`
	}
	// If the cell was the blank one, create a new blank cell after it.
	if (input.innerHTML === "") {
		const row = input.parentElement;
		const cell = document.createElement("td");
		// Add the new cell right after the input
		if(input.nextSibling) {
			row.insertBefore(cell, input.nextSibling);
		}
		else {
			row.appendChild(cell);
		}
		cell.outerHTML = `<td id="${name}${this[name]++}"
											ondragover = "event.preventDefault()"
											ondrop = "${dropCode}"${dragCode}></td>`;
	}

	else if (name === "faveNode") {
		this.login.deleteFavorite(input);
	}

	// If the data represent a node, then we should have, among other things, name, type (the label) and nodeID (the GUID).
	input.innerHTML = `<input type="button" value="X" onclick="${deleteCode}">
	<span onclick = "app.openNode('${data.DBType}', '${data.nodeID}')">${data.name}:${data.type}</span>`;
	input.setAttribute('GUID', data.nodeID);
	input.setAttribute('name', data.name);
	input.setAttribute('type', data.DBType);
	input.setAttribute('label', data.type);
}

openNode(type, GUID) {
	if (type == 'mindmap') {
		new widgetSVG(null, GUID);
	}
	else if (type == "calendar") {
		new widgetCalendar(null, GUID);
	}
	else {
		new widgetNode(null, type, GUID);
	}

}

deleteLink(input) {
	let cell = input.parentElement;
	let row = cell.parentElement;
	row.removeChild(cell);
}

checkOwner(type, newItem, domElement, object, method, name, userRequest, ...args) {
	if (newItem || (object.owner && object.owner.id !== this.login.userID)) { // If the user asked for a new item, or the node is owned by someone else
		const obj = {"type":type, "properties":{"name":name}};

		this.REST.sendQuery(obj, "createNode", "Creating node", userRequest, domElement, null, null, function(data, userRequest, domElement, object, method, ...args) {
			this.setOwner(domElement, userRequest, object, method, data, ...args);
		}.bind(this), domElement, object, method, ...args);

	}
	else {
		if (object.owner) { // If the node already has an owner (which should be the user at this point), it still belongs to them - no need to update
			object[method](null, userRequest, ...args); // method should be prepared to take data and userRequest as the first two args
		}
		else {
			this.setOwner(domElement, userRequest, object, method, null, ...args); // This should rarely happen - but if the node already existed and DIDN'T have an owner, it belongs to this user (for now).
		}
	}
}

// Make the logged-in user the owner of this node
setOwner(domElement, userRequest, object, method, data, ...args) { // If there is data, this was called after creating a new node. Set the ID accordingly.
	if (data) {
		object.id = data[0].node.id;
		object.GUID = data[0].node.properties.M_GUID;
	}

	object.owner = {"name":this.login.userName, "id":this.login.userID};

	const obj = {};
	obj.from = {"id":object.id};
	obj.to = {"id":this.login.userID};
	obj.rel = {"type":"Owner"};

	this.REST.sendQuery(obj, "createRelation", "Setting owner", userRequest, domElement, null, null, function(data, userRequest, object, method, ...args) {
		if (object && method) {
			object[method](data, userRequest, ...args);
		}
	}.bind(this), object, method, ...args);
}

error(message, err) {
	if (!err) {
		err = new Error();
	}

	const line = err.line;
	const col = err.column;
	const URL = err.sourceURL;
	const stack = err.stack;


	alert(`An error has occurred. Details: ${message}\nStack:${stack}`);
}

// DOMelement is usually the whole widget, but it will also work if it's an element from within the widget.
// Use it to work up to the top-level widget, then give it a class of "requestRunning".
startProgress(DOMelement, text, length) {
	let topWidget = null;
	let recordStartTime = null;

	while (DOMelement) {
		if (DOMelement.classList.contains("widget")) {
			topWidget = DOMelement;
		}
		DOMelement = DOMelement.parentElement;
	}

	// topWidget should now be the top-level widget containing the element, or null if the element doesn't exist or isn't in a widget
	if (topWidget) {
		const freezables = topWidget.getElementsByClassName('freezable');
		for (let i = 0; i < freezables.length; i++) {
			freezables[i].classList.add("requestRunning");
		}
		const header = topWidget.getElementsByClassName('widgetHeader');
		for (let i = 0; i < header.length; i++) {
			header[i].classList.add("grayedOut");
		}

		const cancel = this.domFunctions.getChildByIdr(topWidget, 'cancelButton');
		cancel.classList.remove('hidden');
	}

	const startTime = performance.now();
	let update = null;

	const avail = document.getElementById("available");
	if (avail) {
		avail.hidden = true;
	}
	const ongoing = document.getElementById("ongoing");
	if (ongoing) {
		ongoing.hidden = false;

		const row = document.createElement("LI");
		if (topWidget && topWidget.id) {
			row.setAttribute("widget", topWidget.id);
		}
		const status = document.createTextNode(text);
		const timer = document.createElement("SPAN");
		timer.innerHTML = ":  0 ms";
		row.appendChild(status);
		row.appendChild(timer);
		ongoing.appendChild(row);

		update = setInterval(function () {
			const currTime = performance.now();
			const elapsedTime = currTime - startTime;
			timer.innerHTML = `:  ${Math.round(elapsedTime)} ms`;
		}, 10);

		row.setAttribute("update", update);
	}

	const requestObj = {"timer":update};
	if (topWidget) {
		const id = topWidget.getAttribute('id');
		const JSinstance = this.widgets[id];
		if (JSinstance) {
			if (JSinstance.requests == undefined) { // make sure there's a requests array
				JSinstance.requests = [];
			}
			JSinstance.requests.push(requestObj);
		}
	}

	let count = null;
	if (this.login.sessionGUID && this.login.browserGUID) { // if a session is ongoing, record the request
	  count = this.login.requestCount++; // Will have to pass this around later, in order to track which request is which
		requestObj.count = count;

		recordStartTime = Date.now();
		requestObj.startTime = recordStartTime;

	  const obj = {};
	  obj.from = {"type":"M_Session", "properties":{"M_GUID":this.login.sessionGUID}};
	  obj.rel = {"type":"Request", "properties":{"count":count, "description":text, "startTime":recordStartTime, "requestLength":length}};
	  obj.to = {"type":"M_Browser", "properties":{"M_GUID":this.login.browserGUID}};

	  const xhttp = new XMLHttpRequest();

	  xhttp.open("POST","");
	  const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": "upkeep", "token":"upkeep"};
	  xhttp.send(JSON.stringify(queryObject));         // send request to server
	} // end if (a session is ongoing)
	return requestObj; // Info stopProgress will need later
}

stopProgress(DOMelement, obj, length) {
	let requests = [];
	let topWidget = null;
	let result = "Succeeded";

	let DOMelSearch = DOMelement;

	while (DOMelSearch) { // Get the top widget that the DOM element is in
		if (DOMelSearch.classList.contains("widget")) {
			topWidget = DOMelSearch;
		}
		DOMelSearch = DOMelSearch.parentElement;
	}

	let JSinstance = null;

	if (topWidget) {
		const id = topWidget.getAttribute('id');
		JSinstance = this.widgets[id];
	}

	// If this was called by a cancel button (and the button was passed in), get the request list from the widget the cancel button was in
	if (DOMelement && DOMelement.tagName == 'INPUT' && DOMelement.type == "button" && DOMelement.value == "Cancel" && JSinstance) {
		requests = Array.from(JSinstance.requests); // This will include timer, count and startTime. Make a copy so as not to change requests while changing JSinstance.requests
		result = "Cancelled";
	}

	// If this was called by a request finishing (and a widget element and update object were passed in), use the update object as the request
	else if (obj) {
		requests.push(obj);
	}

	for (let i = 0; i < requests.length; i++) {
		if (requests[i].timer) {
			clearInterval(requests[i].timer);
		}
		if (JSinstance) {
			JSinstance.requests.splice(JSinstance.requests.indexOf(requests[i]), 1); // remove from JS class, if it exists
		}

		// If a session is running, and the count is defined (meaning that this request was logged when it began),
		// then update the record of that request now.
		if (this.login.sessionGUID && this.login.browserGUID && requests[i].count !== undefined) {
			const duration = Date.now() - requests[i].startTime;

			const obj = {};
			obj.from = {"type":"M_Session", "properties":{"M_GUID":this.login.sessionGUID}};
			obj.rel = {"type":"Request", "properties":{"count":requests[i].count}};
			obj.to = {"type":"M_Browser", "properties":{"M_GUID":this.login.browserGUID}};
			obj.changes = [
					{"item":"rel", "property":"duration", "value":duration},
					{"item":"rel", "property":"endResult", "value":result},
			];

			if (length) { // if the length is not undefined - meaning if this was called after a response was received, not by a cancel button
				obj.changes.push({"item":"rel", "property":"responseLength", "value":length});
			}

			const xhttp = new XMLHttpRequest();

			xhttp.open("POST","");
			const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": "upkeep", "token":"upkeep"};
			xhttp.send(JSON.stringify(queryObject));         // send request to server
		}
	}

	// topWidget should now be either
	// a) the top-level widget containing the element which was passed in (usually the case), or
	// b) null (if the element passed in didn't exist or wasn't in a widget)

	// If the top widget exists, the JS class for that widget exists and all requests have been cleared,
	// unfreeze its freezable parts and hide the cancel button
	if (topWidget && JSinstance && JSinstance.requests.length === 0) {
		const freezables = topWidget.getElementsByClassName('freezable');
		for (let i = 0; i < freezables.length; i++) {
			freezables[i].classList.remove("requestRunning");
		}
		const header = topWidget.getElementsByClassName('widgetHeader');
		for (let i = 0; i < header.length; i++) {
			header[i].classList.remove("grayedOut");
		}

		const cancel = this.domFunctions.getChildByIdr(topWidget, 'cancelButton');
		cancel.classList.add('hidden');
	}
}

clearRequests() {
	// For each row, get the update and clear the interval (just in case it's still going)
	const ongoing = document.getElementById("ongoing");
	const rows = ongoing.children;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const update = row.getAttribute('update');
		clearInterval(update);
	}

	// Then remove all rows from the ongoing list, hide it and show the available text
	ongoing.innerHTML = "";
	ongoing.hidden = true;

	const avail = document.getElementById("available");
	avail.hidden = false;

	const box = ongoing.parentElement;

	// Repaint the box - there's a bug (NOT in my code - a known issue) that makes it disappear when the scrollbars disappear
	box.parentElement.insertBefore(box, box.nextElementSibling);

}

showHelp(widgetType, button, nodeType) {
	if (!nodeType) {
		nodeType = "M_Widget";
	}
	const obj = {};
	obj.node = {"type":nodeType, "properties":{"name":widgetType}, "merge":true}; // If the help node doesn't exist, create it

	this.sendQuery(obj, 'changeNode', `Searching for help on ${widgetType}`, null, null, null, function(data, button) {
		if (data.length == 0) {
			this.error("Help could not be found or created");
		}
		else if (data.length == 1) {
			new widgetNode(button, "M_Widget", data[0].node.properties.M_GUID);
		}
		else {
			this.error("Multiple help nodes found");
		}
	}.bind(this), button);
}

createLIS(dataArray, compFunction) {
	// compFunction is the comparison function. If none was passed in, it defaults to simple comparison using >.
	if (!compFunction) {
		compFunction = function(x, y) {if (x > y) return 1; else return -1}; // Returns positive if x is bigger, negative if y is bigger
	}

	// indices[i] stores the index of the smallest value which ends an i-long ordered subsequence.
	// It is increasing (both in terms of the values and in terms of the indices of the values),
	// because if you take the i-long subsequence and remove the last item,
	// you get an i-minus-1-long subsequence which ends with a lower (and earlier) value.
	const indices = [];

	// predecessors [i] stores the index of the NEXT-TO-LAST item in the i-long ordered subsequence.
	const predecessors = [];

	let length = 0; // Length of the longest ordered subsequence found so far.

	for (let i = 0; i < dataArray.length; i++) {
		// Binary search for the largest positive j ≤ length such that dataArray[indices[j]] < dataArray[i].
		// That is, the length of the longest subsequence we could ADD dataArray[i] to and still have an increasing subsequence.
		// The definition of "less than" depends on the comparison function passed in - if none was passed in, just compare.
		let low = 1;
		let high = length;
		while (low <= high) {
			let mid = Math.ceil((low + high)/2);

			const thisObj = dataArray[i];
			const indexToCompare = indices[mid];
			const compareObj = dataArray[indexToCompare];
			if (compFunction(compareObj, thisObj) < 0) {
				low = mid + 1;
			}
			else {
				high = mid - 1;
			}
		}

		// After searching, low is 1 greater than the length of the longest prefix of dataArray[i] -
		// in other words, the length of the new subsequence we can make using dataArray[i].
		const newlength = low;

		// The predecessor of dataArray[i] is the last index of the subsequence of length newlength-1
		predecessors[i] = indices[newlength-1];
		indices[newlength] = i;

		if (newlength > length) { // If we found a subsequence longer than any we've found yet, update length
			length = newlength;
		}
	} // end for (every item in dataArray)

	 // Reconstruct the longest increasing subsequence
	 const sequence = [];
	 let k = indices[length];
	 for (let i = length-1; i >= 0; i--) {
		 sequence[i] = dataArray[k];
		 k = predecessors[k];
	 }

	 return sequence; // Returns the LIS array, which is a subset of elements from the original dataArray
}

setUpPopup(JSobj) {
	// create popup
	const fieldPopup = document.createElement("div");
	fieldPopup.setAttribute("hidden", "true");
	fieldPopup.setAttribute('class', 'fieldPopup')
	fieldPopup.innerHTML =
	`<div class="popupHeader" idr="popupHeader"></div>
	<div>
		<p>Display Name: <input idr="labelInput" type="text"></p>
		<p>Description: <span idr="description"></span></p>
		<p><input idr="showTable" type="checkbox"> Show this field in the table</p>
		<p><input idr="showForm" type="checkbox"> Show this field in the detailed form</p>
		<p><input type="button" idr="restoreSizeButton" value="Restore textarea in form to default size"
			onclick="app.widget('restoreSize', this)"></p>
		<p><input type="button" value="OK" onclick = "app.widget('popupOK', this)">
		<input type="button" value="Cancel" onclick="app.widget('popupCancel', this)"></p>
	</div>`;

	fieldPopup.setAttribute("idr", "fieldPopup");

	if (!JSobj.app) {
		JSobj.app = this;
	}

	JSobj.showPopup = function(label) {
	  this.fieldPopup.hidden = false;
	  const bounds = label.getBoundingClientRect();
	  this.fieldPopup.setAttribute("style", `left:${bounds.left + window.scrollX}px; top:${bounds.top + window.scrollY}px`);
	  // set text in popup header to "actual" field name (stored as db of label)
	  const fieldName = label.getAttribute('db');
	  const header = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'popupHeader');
	  header.innerHTML = fieldName;
	  // set text in label textbox to "label" field name (stored as text of label)
	  const labelInput = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'labelInput');
	  labelInput.value = label.textContent;

		let desc = "None";
		if (this.fields[fieldName].description) {
			desc = this.fields[fieldName].description;
		}
		const descText = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'description');
		descText.innerHTML = desc;

	  // Show or hide restore size button
	  const restoreSize = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'restoreSizeButton');
	  if (this.fields[fieldName].input && this.fields[fieldName].input.name === "textarea") {
	    restoreSize.classList.remove("hidden");
	  }
	  else {
	    restoreSize.classList.add("hidden");
	  }

	  const tableCheck = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'showTable');
	  if (this.fieldsDisplayed.indexOf(fieldName) != -1) {
	    tableCheck.checked = true;
	  }
	  else {
	    tableCheck.checked = false;
	  }
	  const formCheck = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'showForm');
	  if (this.formFieldsDisplayed.indexOf(fieldName) != -1) {
	    formCheck.checked = true;
	  }
	  else {
	    formCheck.checked = false;
	  }
	}

	JSobj.popupCancel = function() {
	  this.fieldPopup.hidden = true;
	}

	JSobj.popupOK = function(button) {
	  // Get the DOM elements and the db name of the field being edited
	  const header = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'popupHeader');
	  const label = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'labelInput');
	  const tableCheck = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'showTable');
	  const formCheck = this.app.domFunctions.getChildByIdr(this.fieldPopup, 'showForm');
	  const db = header.textContent;

	  // update metadata class
	  if (tableCheck.checked && this.fieldsDisplayed.indexOf(db) == -1) { // If the field should be displayed and currently isn't
	    this.fieldsDisplayed.push(db);
	  }

	  else if (!(tableCheck.checked) && this.fieldsDisplayed.indexOf(db) != -1) { // If the field shouldn't be displayed and is
	    this.fieldsDisplayed.splice(this.fieldsDisplayed.indexOf(db), 1);
	  }

	  if (formCheck.checked && this.formFieldsDisplayed.indexOf(db) == -1) { // If the field should be displayed and currently isn't
	    this.formFieldsDisplayed.push(db);
	  }

	  else if (!(formCheck.checked) && this.formFieldsDisplayed.indexOf(db) != -1) { // If the field shouldn't be displayed and is
	    this.formFieldsDisplayed.splice(this.formFieldsDisplayed.indexOf(db), 1);
	  }

	  this.fields[db].label = label.value;

		// update widget
		this.refresh();

		// create or update link
		let userRequest = this.app.REST.startUserRequest("Update metadata settings", this.widgetDOM);

	  const obj = {};
	  obj.from = {"id":this.app.login.userID, "return":false};
	  obj.rel = {"type":"Settings", "merge":true, "return":false};
	  obj.to = {"type":"M_MetaData", "properties":{"name":this.queryObjectName}, "return":false};
	  obj.changes = [{"item":"rel", "property":"fields", "value":this.app.stringEscape(JSON.stringify(this.fields))},
	                 {"item":"rel", "property":"fieldsDisplayed", "value":this.app.stringEscape(JSON.stringify(this.fieldsDisplayed))},
	                 {"item":"rel", "property":"formFieldsDisplayed", "value":this.app.stringEscape(JSON.stringify(this.formFieldsDisplayed))}];

		this.app.REST.sendQuery(obj, "changeRelation", "Updating metadata", userRequest, this.widgetDOM);

	  // close popup
	  this.fieldPopup.hidden = true;
	}

	return fieldPopup;
}

resize() {
	for (let i in this.doOnResize) { // Run all methods that run when a user logs in
		const object = this.doOnResize[i].object;
		const method = this.doOnResize[i].method;
		const args = this.doOnResize[i].args;
		if (object && method in object) { // Assuming the object that was provided still exists and has the given method...
			object[method](...args); // run the method in the object with the args.
		}
	}
}

getProp(o, ...args) {
    while (o && args.length > 0) {
        o = o[args.shift()];
    }
    return args.length ? null : o;
}

sendQuery(obj, CRUD, description, DOMelement, GUID, url, onComplete, ...args) {
	if (!GUID) {
		GUID = this.getProp(this, "login", "userGUID");
	}
	if (!GUID) {
		GUID = "upkeep";
	}

	if (!url) {
		url = "";
	}

	const queryObject = {"server": "CRUD", "function": CRUD, "query": obj, "GUID": GUID, "token":"upkeep"};
	const request = JSON.stringify(queryObject);

	const xhttp = new XMLHttpRequest();
	const update = this.startProgress(DOMelement, description, request.length);
	const app = this;
	const logout = this.login.logout.bind(this.login);

	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			if (this.responseText === "timeout") {
				alert ("Sorry, your session has timed out.");
				logout(true);
			}
			else {
				const responseSize = this.responseText.length;
				const data = JSON.parse(this.responseText);
				app.stopProgress(DOMelement, update, responseSize);
				if (onComplete) {
					onComplete(data, ...args);
				}
			}
		}
	};

	xhttp.open("POST", url);
	xhttp.send(request);         // send request to server
}

clickWidgetEntry(domElement) {
	const widgetID = domElement.getAttribute("idr");
	const widget = document.getElementById(widgetID);

	if (widget && widget.classList.contains("hidden")) { // If the widget was minimized, expand it
		const minimizeButton = this.domFunctions.getChildByIdr(widget, "expandCollapseButton");
		this.widgetCollapse(minimizeButton);
	}

	widget.scrollIntoView();
}

// Used for testing, UI can be hard coded here to reduce amount of clicking to test code.
// Can be called directly by app.html, or by clicking a single button. Currently empty.
test() {}
}  ///////////////////////////////////////////////////////////////// end class
