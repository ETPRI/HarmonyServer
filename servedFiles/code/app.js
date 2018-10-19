// import "module-name";
// import('./widgetList.js');
// import does not work yet, just include modules in index.js in "correct order"

// app.js holds the global functions and data for the application

class app { ///////////////////////////////////////////////////////////////// start class

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

	// Add the regression header and login div to the list of widgets
	this.widgets.regressionHeader = this.regression;
	this.widgets.loginDiv = this.login;

	// Make the workspace and table header visible only when a user is logged in, and remove all widgets when the user logs out.
	this.workSpace = document.getElementById("workSpace");
	this.workSpace.setAttribute("hidden", true);
	this.login.viewLoggedIn.push(this.workSpace);
	this.tableHeader = document.getElementById("tableHeader");
	this.tableHeader.setAttribute("hidden", true);
	this.login.viewLoggedIn.push(this.tableHeader);
	this.adminButtons = document.getElementById("adminButtons");
	this.adminButtons.setAttribute("hidden", true);
	this.login.viewAdmin.push(this.adminButtons);

	const obj = {};
	obj.object = this;
	obj.method = 'clearWidgets';
	obj.args = [];
	this.login.doOnLogout.push(obj);
	document.addEventListener("keydown", this.keyPressed.bind(this));

	// Check for metadata and add it if needed
	this.checkMetaData();

	// Run any test code currently in app
	this.test();
}

checkMetaData() {
	const obj = {};
	obj.node = {"type":"M_MetaData"};

	const xhttp = new XMLHttpRequest();
	const appObj = this;

	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			const data = JSON.parse(this.responseText);
			appObj.addMetaData(data);
		}
	};

	xhttp.open("POST","");
	const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": "setup"};
	xhttp.send(JSON.stringify(queryObject));         // send request to server
}

addMetaData(data) {
	if (!data || data.length == 0) { // If no metadata nodes were found, add them.
		let type;
		for (type in this.metaData.node) {
			const obj = {"type":"M_MetaData", "properties":{"name":type}};
			obj.properties.nodeLabel = this.stringEscape(JSON.stringify(this.metaData.node[type].nodeLabel));
			obj.properties.orderBy = this.stringEscape(JSON.stringify(this.metaData.node[type].orderBy));
			obj.properties.fields = this.stringEscape(JSON.stringify(this.metaData.node[type].fields));
			obj.properties.fieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].fieldsDisplayed));
			obj.properties.formFieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].formFieldsDisplayed));

			const xhttp = new XMLHttpRequest();

	    xhttp.open("POST","");
			const queryObject = {"server": "CRUD", "function": "createNode", "query": obj, "GUID": "setup"};
			xhttp.send(JSON.stringify(queryObject));         // send request to server
		}
	}

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

			const updated = this.updateObject(this.metaData.node[name], node); // Bring in any fields which are in metadata but aren't in node
			this.metaData.node[name] = node;

			if (updated) { // If anything was added to the DB node from the metadata class, save the updated DB node
				const obj = {};
				obj.node = {"type":"M_MetaData", "properties":{"name":name}};
				obj.changes = [{"property":"nodeLabel", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].nodeLabel))}
											,{"property":"orderBy", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].orderBy))}
											,{"property":"fields", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].fields))}
											,{"property":"fieldsDisplayed", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].fieldsDisplayed))}
											,{"property":"formFieldsDisplayed", "value":this.stringEscape(JSON.stringify(this.metaData.node[name].formFieldsDisplayed))}];

				const xhttp = new XMLHttpRequest();

				xhttp.open("POST","");
				const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": "setup"};
				xhttp.send(JSON.stringify(queryObject));         // send request to server
			}
			node.name = name; // put the name back for the next step
		}

		let type;
		for (type in this.metaData.node) { // for every entry in this.metaData.node...
			let DBNode = data.find(x => x.node.properties.name === type); // look for a matching DB metadata node.
			if (!DBNode && type !== "all") { // If there is no such node, create one (except for "all", which doesn't get a node).
				const obj = {"type":"M_MetaData", "properties":{"name":type}};
				obj.properties.nodeLabel = this.stringEscape(JSON.stringify(this.metaData.node[type].nodeLabel));
				obj.properties.orderBy = this.stringEscape(JSON.stringify(this.metaData.node[type].orderBy));
				obj.properties.fields = this.stringEscape(JSON.stringify(this.metaData.node[type].fields));
				obj.properties.fieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].fieldsDisplayed));
				obj.properties.formFieldsDisplayed = this.stringEscape(JSON.stringify(this.metaData.node[type].formFieldsDisplayed));

				const xhttp = new XMLHttpRequest();

				xhttp.open("POST","");
				const queryObject = {"server": "CRUD", "function": "createNode", "query": obj, "GUID": "setup"};
				xhttp.send(JSON.stringify(queryObject));         // send request to server
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

// Makes the debug header visible, and changes the button used to show it into a "Hide Debug" button
showDebug(button) {
	const debugHeader = document.getElementById('debugHeader');
	debugHeader.removeAttribute("hidden");
	button.setAttribute("value", "Hide Debug Menu");
	button.setAttribute("onclick", "app.hideDebug(this)");
}

// Makes the debug header invisible, and changes the button used to hide it into a "Show Debug" button
hideDebug(button) {
	const debugHeader = document.getElementById('debugHeader');
	debugHeader.setAttribute("hidden", "true");
	button.setAttribute("value", "Show Debug Menu");
	button.setAttribute("onclick", "app.showDebug(this)");
}

// Makes the regression header visible, and changes the button used to show it into a "Hide Regression" button
showRegression(button) {
	const regressionHeader = document.getElementById('regressionHeader');
	regressionHeader.removeAttribute("hidden");
	button.setAttribute("value", "Hide Regression Menu");
	button.setAttribute("onclick", "app.hideRegression(this)");
}

// Makes the regression header invisible, and changes the button used to show it into a "Show Regression" button
hideRegression(button) {
	const regressionHeader = document.getElementById('regressionHeader');
	regressionHeader.setAttribute("hidden", "true");
	button.setAttribute("value", "Show Regression Menu");
	button.setAttribute("onclick", "app.showRegression(this)");
}

// Removes all widgets other than the login div and regression header from both the screen and the widgets array
clearWidgets() {
	for (let id in this.widgets) { // For every widget...
		if (id != "loginDiv" && id != "regressionHeader") { // (except for the login div and regression header)...
			// Remove widget objects
			delete this.widgets[id];

			// delete  html2 from page
			const widget = document.getElementById(id);
			if (widget) {
				widget.parentElement.removeChild(widget);
			}
		}
	}
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
	const header = document.getElementById("debugHeader");
	if (header) {
		header.outerHTML = `
			<div id="debugHeader" hidden="true">
				<p>	|-&gt; debugging</p>
				<select id="metaData" onchange="app.menuDBstats(this); this.selectedIndex = 0">
					<option value="">MetaData</option>
					<option value="nodes">Nodes</option>
					<option value="keysNode">Node Keys</option>
					<option value="relations">Relations</option>
					<option value="keysRelation">Relation Keys</option>
					<option value="dataBrowser">Data Browser</option>
					<option value="allTrash">All Trashed Nodes</option>
				</select>
				<input type="button" id="LogButton" value="Start Logging" onclick="app.regression.logToggle(this)">
				<input type="button" id="Clear" value="Clear ALL" onclick="app.regression.clearAll(app)">
				<input type="button" id="checkEmpty" value="Check whether database is empty" onclick="app.checkEmpty.checkEmpty(this)">
				Most recent DB query: <input type="text" size="80">
				<p>
					<a href="http://localhost:7474/browser/" target="_blank">Neo4j Browser</a>
					To use this site, Neo4j Desktop must be running with a database started.
				</p>
				<hr>
			</div>
		`

		const obj = {};
		obj.object = this;
		obj.method = 'hideDebug';
		const debugButton = document.getElementById('debugButton');
		obj.args = [debugButton];
		this.login.doOnLogout.push(obj);
	}
}

// Runs when a search button is clicked. Shows the table associated with that search button.
menuNodes(name) {
	if (this.shownTable) {
		this.shownTable.hidden = true;
		this.shownTable = null;
	}

	let newTable = document.getElementById(name);
	if (newTable) {
		newTable.hidden = false;
		this.shownTable = newTable;
		let newTableJS = this.widgets[name];
		newTableJS.search();
	}
}

// displays meta-data on nodes, keysNodes, relations, keysRelations, and all nodes that have been trashed.
// If the user is logged in, will also show them the nodes they, personally, have trashed, as well as their reasons.
menuDBstats(dropDown){
	// Get the value from the metadata dropdown.
	const value = dropDown.options[dropDown.selectedIndex].value;
	// If the value is blank (placeholder is selected) do nothing; else create a new widgetTableQuery and store in this.widgets.
	if (value==="") return;

	if (value ==="dataBrowser") {
		new dataBrowser();
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
// Does not close the header div or outer element.
widgetHeader(widgetType, tag){
	if (!tag) {
		tag = "div";
	}
	return(`
	<${tag} id="${this.idCounter++}" class="widget fullWidth" ondrop="app.drop(this, event)" ondragover="event.preventDefault()"
	onmousedown="app.setActiveWidget(this)">
	<hr>
	<div idr="header" class="widgetHeader" draggable="true" ondragstart="app.drag(this, event)">
	<input type="button" value="X" idr="closeButton" onclick="app.widgetClose(this)">
	<input type="button" value="__" idr="expandCollapseButton" onclick="app.widgetCollapse(this)">
	<input type="button" value = "<>" idr="fullScreenButton" onclick = "app.widgetFullScreen(this)">
	<input type="button" value="?" idr="helpButton" onclick="app.showHelp('${widgetType}', app.domFunctions.widgetGetId(this))">
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

	const children = Array.from(domElement.parentElement.parentElement.children);
	let widgetBody;
	for (let i = 0; i < children.length; i++) {
		if (children[i].classList.contains('widgetBody')) {
			widgetBody = children[i];
			break;
		}
	}

	if (widgetBody) {
		widgetBody.hidden = !widgetBody.hidden  // toggle hidden
		if(widgetBody.hidden) {
			domElement.value = "+";
		} else {
			domElement.value = 	"__";
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

	// If the widget to "close" is a table widget, just hide it.
	if (widget.classList.contains('tableWidget')) {
		widget.hidden = true;
		this.shownTable = null;
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
		widgetElement.value = "><";
	}
	else if (widgetElement.value === "><") {
		// Show all previously hidden elements on the screen
		const hidden = document.getElementsByClassName('hiddenForFS');
		while (hidden.length > 0) {
			hidden[0].classList.remove("hiddenForFS");
		}

		widget.classList.remove("fullScreen");
		widgetElement.value = "<>";
	}
	else {
		this.error("Widget fullscreen button's value is not <> or ><");
	}
}

// Escapes special character in a string. Stringifying it and then removing the outer quotes is a good shortcut.
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
drag(widget, evnt) {
	this.activeWidget = evnt.target;
	while (this.activeWidget.parentNode.id != "widgets") { // Make the active node being dragged the top-level widget that the target was in
		this.activeWidget = this.activeWidget.parentElement;
	}

	// Stores information about the item being dragged in dataTransfer
	const data = {};
	data.sourceID = this.domFunctions.widgetGetId(widget);
	data.sourceType = "widget";
	data.sourceTag = widget.tagName;
	evnt.dataTransfer.setData("text/plain", JSON.stringify(data));

	const obj = {};
	obj.id = this.domFunctions.widgetGetId(evnt.target);
	obj.action = "dragstart";
	this.regression.log(JSON.stringify(obj));
	this.regression.record(obj);
}

// Prevents the default action of a drop so that we can write our own ondrop methods.
allowDrop(input, evnt) {
	evnt.preventDefault();
}

// Used for rearranging. When something is dropped onto a widget, check to verify that it's another widget,
// then insert the widget that was dragged above (if dragging up) or below (if dragging down) the one it was dropped onto.
drop(widget, evnt) {
	evnt.preventDefault();

	// Get the data about the object being dragged
	const dataText = evnt.dataTransfer.getData("text/plain");
	let data = {};
	if (dataText) {
	  data = JSON.parse(dataText);
	}

	if (data.sourceType == "widget" && data.sourceTag == "DIV") { // Make sure the object being dragged is a widget
		let target = evnt.target;

		// Make sure we're dropping into a top-level widget - one whose parent is the widgets div
		while (target.parentNode.id != "widgets") {
			target = target.parentNode;
		}

		if (this.activeWidget) { // If activeWidget (the DOM element being dragged) exists
			if (this.activeWidget.offsetTop < target.offsetTop) {  // drag down
				target.parentNode.insertBefore(this.activeWidget, target.nextSibling); // Insert after target
			}
			else { // drag up
				target.parentNode.insertBefore(this.activeWidget, target); // Insert before target
			}
		}

		this.activeWidget = null; // Nothing is actively being dragged anymore - the thing that was being dragged was dropped.

		const obj = {};
		obj.id = this.domFunctions.widgetGetId(evnt.target);
		obj.action = "drop";
		this.regression.log(JSON.stringify(obj));
		this.regression.record(obj);
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
	// Call dragdrop.drag to handle it.
	if (data && data.sourceType == "dragDrop" && data.sourceTag == "TD" && data.sourceID == this.domFunctions.widgetGetId(input)) {
		this.widget('drop', input, evnt);
		return;
	}

	// Otherwise, verify that the data represent a node
	else if (!data || !(
			data.sourceType == "widgetTableNodes" && data.sourceTag == "TD" ||
			data.sourceType == "widgetRelations" && data.sourceTag == "TR" ||
			data.sourceType == "widgetNode" && data.sourceTag == "B" ||
			data.sourceType == "dragDrop" && data.sourceTag == "TR"
		)) {
		return;
	}

	// Figure out which type of cell this was dropped into - for now, choices are dropNode and faveNode
	const name = input.getAttribute("id").slice(0,8); // dropNode or faveNode - have to tweak this logic if I ever have a choice without 8 chars
	let dropCode = "app.dropLink(this, event)";
	let deleteCode = "app.deleteLink(this)";
	let dragCode = "";
	if (name === "faveNode") {
		dropCode += "; app.widget('saveFavorite', this)";
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
	<span onclick = "app.openNode('${data.type}', '${data.nodeID}')">${data.name}:${data.type}</span>`;
	input.setAttribute('GUID', data.nodeID);
	input.setAttribute('name', data.name);
	input.setAttribute('type', data.type);
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

error(message) {
	const err = new Error();
	const line = err.line;
	const col = err.column;
	const URL = err.sourceURL;
	const stack = err.stack;


	alert(`An error has occurred. Details: ${message}\nStack:${stack}`);
}

// DOMelement is usually the whole widget, but it will also work if it's an element from within the widget.
// Use it to work up to the top-level widget, then give it a class of "requestRunning".
startProgress(DOMelement, text) {
	let topWidget = null;

	while (DOMelement) {
		if (DOMelement.classList.contains("widget")) {
			topWidget = DOMelement;
		}
		DOMelement = DOMelement.parentElement;
	}

	// topWidget should now be the top-level widget containing the element, or null if the element doesn't exist or isn't in a widget
	if (topWidget) {
		topWidget.classList.add("requestRunning");
	}

	const avail = document.getElementById("available");
	avail.hidden = true;
	const ongoing = document.getElementById("ongoing");
	ongoing.hidden = false;

	const row = document.createElement("LI");
	if (topWidget && topWidget.id) {
		row.setAttribute("widget", topWidget.id);
	}
	const status = document.createTextNode(text);
	const cancel = document.createElement("INPUT");
	cancel.setAttribute("type", "button");
	cancel.setAttribute("value", "Cancel");
	cancel.setAttribute("onclick", 'app.stopProgress(this)');
	cancel.disabled = true;
	const timer = document.createElement("SPAN");
	timer.innerHTML = ":  0 ms";
	row.appendChild(status);
	row.appendChild(timer);
	row.appendChild(cancel);
	ongoing.appendChild(row);

	const startTime = performance.now();
	const update = setInterval(function () {
		const currTime = performance.now();
		const elapsedTime = currTime - startTime;
		timer.innerHTML = `:  ${Math.round(elapsedTime)} ms`;
		if (elapsedTime > 1000) {
			cancel.disabled = false;
		}}, 10);
	row.setAttribute("update", update);

	let count = null;
	if (this.login.sessionGUID && this.login.browserGUID) { // if a session is ongoing, record the request
	  count = this.login.requestCount++; // Will have to pass this around later, in order to track which request is which

	  const obj = {};
	  obj.from = {"type":"M_Session", "properties":{"M_GUID":this.login.sessionGUID}};
	  obj.rel = {"type":"Request", "properties":{"count":count, "description":text, "startTime":Date.now()}};
	  obj.to = {"type":"M_Browser", "properties":{"M_GUID":this.login.browserGUID}};

	  const xhttp = new XMLHttpRequest();

	  xhttp.open("POST","");
	  const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": "upkeep"};
	  xhttp.send(JSON.stringify(queryObject));         // send request to server
	}
	row.setAttribute("count", count);

	return {"update":update, "row":row, "count":count}; // Info stopProgress will need later
}

stopProgress(DOMelement, obj) {
	let row = null;
	let update = null;
	let topWidget = null;
	let count = null;
	let result = "Succeeded";

	// If this was called by a cancel button (and the button was passed in)
	if (DOMelement && DOMelement.tagName == 'INPUT' && DOMelement.type == "button" && DOMelement.value == "Cancel") {
		row = DOMelement.parentElement;
		update = row.getAttribute("update");
		topWidget = document.getElementById(row.getAttribute("widget"));
		count = row.getAttribute("count");
		result = "Cancelled";
	}

	// If this was called by a request finishing (and a widget element and update object were passed in)
	else {
		if (obj) {
			row = obj.row;
			update = obj.update;
			count = obj.count;
		}

		// Go to the top-level widget
		while (DOMelement) {
			if (DOMelement.classList.contains("widget")) {
				topWidget = DOMelement;
			}
			DOMelement = DOMelement.parentElement;
		}
	}

	// topWidget should now be either
	// a) the top-level widget stored in the row (usually the case when cancelling),
	// b) the top-level widget containing the element which was passed in (usually the case when finishing a request), or
	// c) null (if the row stored no widget, or if the element passed in didn't exist or wasn't in a widget)
	if (topWidget) {
		topWidget.classList.remove("requestRunning");
	}

	clearInterval(update);
	let list = document.getElementById("ongoing"); // list should be the parent of row
	if(row && row.parentElement == list) {
		list.removeChild(row);
	}
	else {
		this.error("The row to be removed is not in the list of ongoing requests");
	}

	// If a session is running, and the count is non-null (meaning that this request was logged when it began),
	// then update the record of that request now.
	if (this.login.sessionGUID && this.login.browserGUID && !(count == null)) {
		const obj = {};
		obj.from = {"type":"M_Session", "properties":{"M_GUID":this.login.sessionGUID}};
		obj.rel = {"type":"Request", "properties":{"count":count}};
		obj.to = {"type":"M_Browser", "properties":{"M_GUID":this.login.browserGUID}};
		obj.changes = [
				{"item":"rel", "property":"endTime", "value":Date.now()},
				{"item":"rel", "property":"endResult", "value":result}
		];

		const xhttp = new XMLHttpRequest();

		xhttp.open("POST","");
		const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": "upkeep"};
		xhttp.send(JSON.stringify(queryObject));         // send request to server
	}

	const box = list.parentElement;

	// Repaint the box - there's a bug (NOT in my code - a known issue) that makes it disappear when the scrollbars disappear
	box.parentElement.insertBefore(box, box.nextElementSibling);

	if (list.children.length == 0) { // If there are no more items in the list of ongoing calls
		const avail = document.getElementById("available");
		avail.hidden = false;
		const ongoing = document.getElementById("ongoing");
		ongoing.hidden = true;
	}
}

showHelp(widgetType, button, nodeType) {
	if (!nodeType) {
		nodeType = "M_Widget";
	}
	const obj = {};
	obj.node = {"type":nodeType, "properties":{"name":widgetType}, "merge":true}; // If the help node doesn't exist, create it
	const xhttp = new XMLHttpRequest();
	const update = this.startProgress(null, `Searching for help on ${widgetType}`);
	const app = this;

	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			const data = JSON.parse(this.responseText);
			app.stopProgress(null, update);
			if (data.length == 0) {
				app.error("Help could not be found or created");
			}
			else if (data.length == 1) {
				new widgetNode(button, "M_Widget", data[0].node.properties.M_GUID);
			}
			else {
				app.error("Multiple help nodes found");
			}
		}
	};

	xhttp.open("POST","");
	const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": this.login.userGUID};
	xhttp.send(JSON.stringify(queryObject));         // send request to server
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
// Used for testing, UI can be hard coded here to reduce amount of clicking to test code.
// Can be called directly by app.html, or by clicking a single button. Currently empty.
test() {}
}  ///////////////////////////////////////////////////////////////// end class
