// import "module-name";
// import('./widgetList.js');
// import does not work yet, just include modules in index.js in "correct order"

// app.js holds the global functions and data for the application

class app { ///////////////////////////////////////////////////////////////// start class

// called once by app.html to create the one instance
constructor() {
	this.widgets   = {}; // store widgets as they are created, remove when closed
	this.idCounter = 0;  // init id counter - used get getElementById, is the id of the widget

	this.activeWidget = null; // widget being dragged
	this.shownTable = null; // visible table widget
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

	const obj = {};
	obj.object = this;
	obj.method = 'clearWidgets';
	obj.args = [];
	this.login.doOnLogout.push(obj);
	document.addEventListener("keydown", this.keyPressed.bind(this));

	// Check the brower capabilities and, if applicable, report that it definitely won't work or that it's not tested
	this.supportsES6();

	// Create preset calendar options
	this.presetCalendars();

	// Create temp admin account if a real one doesn't yet exist; delete it if a real one does exist
	this.login.checkAdminTable();

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

	else { // if data were found, it will be an array of metadata nodes
		let metaData = {};
		for (let i = 0; i < data.length; i++) {
			const node = data[i].node.properties;
			metaData[node.name] = {};
			metaData[node.name].nodeLabel = JSON.parse(node.nodeLabel);
			metaData[node.name].orderBy = JSON.parse(node.orderBy);
			metaData[node.name].fieldsDisplayed = JSON.parse(node.fieldsDisplayed);
			metaData[node.name].formFieldsDisplayed = JSON.parse(node.formFieldsDisplayed);
			metaData[node.name].fields = JSON.parse(node.fields);
		}
		this.metaData.node = metaData;
	}
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

	if (method=="allowDrop") {
		// If that ID is associated with a widget object which contains the given method...
		if (id && this.widgets[id] && this.widgets[id][method]) {
			this.widgets[id][method](widgetElement, ...args); //  Call the method, and pass in widgetElement and any extra args
		} else {
	     // Create an error message. This could stand to be more informative, but I'm not sure how best to write it.
			 this.error(`App.widget: method ${method} in widget #${id} could not be called.`);
		}
	}


	else {
		// If that ID is associated with a widget object which contains the given method...
		if (id && this.widgets[id] && this.widgets[id][method]) {
			this.widgets[id][method](widgetElement, ...args); //  Call the method, and pass in widgetElement and any extra args
		} else {
			 // Create an error message. This could stand to be more informative, but I'm not sure how best to write it.
			 this.error(`App.widget: Error, method: ${method}`);
		}
	}
}

// Runs when the page first loads. Gets the dropdown with ID "menuNodes", which starts off with just a placeholder value,
// and adds an option for every type of node listed in this.metadata.
menuNodesInit(){
	const menu = document.getElementById('menuNodes');

	// clear existing options
	while (menu.firstElementChild) {
		menu.remove(menu.firstElementChild);
	}

	const start = document.createElement('option');
	menu.appendChild(start);
	start.outerHTML =  '<option value="">-- Nodes --</option>';


	const selectionTemplate = '<option value="#name#">#label#</option>';
	let html = "";  // build dropdown menu selections
	for (let nodeName in this.metaData.node) { // nodeName is the name of the node, like "people" or "Movie"
		html = selectionTemplate
			.replace(/#label#/g, this.metaData.node[nodeName].nodeLabel)
			.replace(/#name#/g, nodeName);
		const dropDown = document.createElement('option'); // Creates a new placeholder option...
		menu.appendChild(dropDown); // adds it to the menu...
		dropDown.outerHTML = html; // and replaces it with the version made from the selection template.
	}
}

// Creates all the debugging features (metaData dropdown, log button, display for DB queries, etc.) in the debug header.
createDebug() {
	const header = document.getElementById("debugHeader");
	if (header) {
		header.setAttribute("hidden", "true");
		const p = document.createElement('p');
		const text = document.createTextNode('	|-> debugging');
		p.appendChild(text);
		header.appendChild(p);

		const select = document.createElement('select');
		select.setAttribute('id', 'metaData');
		select.setAttribute('onchange', 'app.menuDBstats(this); this.selectedIndex = 0');
		header.appendChild(select);

		const opt1 = document.createElement('option');
		opt1.setAttribute('value', "");
		const opt1text = document.createTextNode('MetaData');
		opt1.appendChild(opt1text);
		select.appendChild(opt1);

		const opt2 = document.createElement('option');
		opt2.setAttribute('value', "nodes");
		const opt2text = document.createTextNode('Nodes');
		opt2.appendChild(opt2text);
		select.appendChild(opt2);

		const opt3 = document.createElement('option');
		opt3.setAttribute('value', "keysNode");
		const opt3text = document.createTextNode('Node Keys');
		opt3.appendChild(opt3text);
		select.appendChild(opt3);

		const opt4 = document.createElement('option');
		opt4.setAttribute('value', "relations");
		const opt4text = document.createTextNode('Relations');
		opt4.appendChild(opt4text);
		select.appendChild(opt4);

		const opt5 = document.createElement('option');
		opt5.setAttribute('value', "keysRelation");
		const opt5text = document.createTextNode('Relation Keys');
		opt5.appendChild(opt5text);
		select.appendChild(opt5);

		const opt6 = document.createElement('option');
		opt6.setAttribute('value', "dataBrowser");
		const opt6text = document.createTextNode('Data Browser');
		opt6.appendChild(opt6text);
		select.appendChild(opt6);

		const opt7 = document.createElement('option');
		opt7.setAttribute('value', "allTrash");
		const opt7text = document.createTextNode('All Trashed Nodes');
		opt7.appendChild(opt7text);
		select.appendChild(opt7);

		const logButton = document.createElement('input');
		logButton.setAttribute('type', 'button');
		logButton.setAttribute('id', 'LogButton');
		logButton.setAttribute('value', 'Start Logging');
		logButton.setAttribute('onclick', 'app.regression.logToggle(this)');
		header.appendChild(logButton);

		const clearButton = document.createElement('input');
		clearButton.setAttribute('type', 'button');
		clearButton.setAttribute('id', "Clear");
		clearButton.setAttribute('value', "Clear ALL");
		clearButton.setAttribute('onclick', 'app.regression.clearAll(app)');
		header.appendChild(clearButton);

		const checkEmpty = document.createElement('input');
		checkEmpty.setAttribute('type', 'button');
		checkEmpty.setAttribute('id', 'checkEmpty');
		checkEmpty.setAttribute('value', "Check whether database is empty");
		checkEmpty.setAttribute('onclick', 'app.checkEmpty.checkEmpty(this)');
		header.appendChild(checkEmpty);

		const debugText = document.createTextNode("Most recent DB query: ");
		header.appendChild(debugText);

		const debugTextbox = document.createElement('input');
		debugTextbox.setAttribute('type', 'text');
		debugTextbox.setAttribute('size', '80');
		header.appendChild(debugTextbox);

		const linkPar = document.createElement('p');
		const link = document.createElement('a');
		link.setAttribute('href', 'http://localhost:7474/browser/');
		link.setAttribute('target', '_blank');
		const linkText = document.createTextNode('Neo4j Browser');
		link.appendChild(linkText);
		linkPar.appendChild(link);
		const descText = document.createTextNode(' To use this site, Neo4j Desktop must be running with a database started.');
		linkPar.appendChild(descText);
		header.appendChild(linkPar);

		const line = document.createElement('hr');
		header.appendChild(line);

		const obj = {};
		obj.object = this;
		obj.method = 'hideDebug';
		const debugButton = document.getElementById('debugButton');
		obj.args = [debugButton];
		this.login.doOnLogout.push(obj);
	}
}

// Runs when an item is chosen from the menu dropdown, or the New button is clicked.
// Creates a table of whatever type of node is selected on the dropdown (nothing happens if the placeholder is selected).
menuNodes(control) {
	// Get the value of the current selection in the dropdown list
	const dropDown = document.getElementById('menuNodes');
	const value = dropDown.options[dropDown.selectedIndex].value;

	// If the value was blank (the placeholder was selected) do nothing.
	if (value==="") return;

	// Otherwise, hide the currently-shown table widget (if any) and show the selected one.
	if (this.shownTable) {
		this.shownTable.hidden = true;
		this.shownTable = null;
	}

	let newTable = document.getElementById(value);
	if (newTable) {
		newTable.hidden = false;
		this.shownTable = newTable;
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

// Runs when the page loads. Ensures all preset calendars exist in the database.
presetCalendars() {
	// At the moment the only preset calendar is a dummy calendar that doesn't show events. This will change.
	const obj = {};
	obj.node = {"type":"calendar", "properties":{"name":"dummy", "description":"dummy calendar"}, "merge":true, "return":false};

	const xhttp = new XMLHttpRequest();

	xhttp.open("POST","");
	const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": "setup"};
	xhttp.send(JSON.stringify(queryObject));         // send request to server
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
widgetHeader(tag){
	if (!tag) {
		tag = "div";
	}
	return(`
	<${tag} id="${this.idCounter++}" class="widget" ondrop="app.drop(this, event)"
				ondragover="app.allowDrop(this, event)" onmousedown="app.setActiveWidget(this)">
	<hr>
	<div idr="header" class="widgetHeader" draggable="true" ondragstart="app.drag(this, event)">
	<input type="button" value="X" idr="closeButton" onclick="app.widgetClose(this)">
	<input type="button" value="__" idr="expandCollapseButton" onclick="app.widgetCollapse(this)">
		`)
}

// Expands or collapses a widget when the expand/collapse button in that widget is clicked.
// Also changes the text on the button back and forth between "__" and "+".

// Currently, assumes that the expand/collapse button is in the header, which is in the widget div
// (it is thus the grandchild of the widget div), which should always be true because all widget headers
// are made the same way by the same function. Also assumes that the widget body - the part to expand or
// collapse - is a child of the widget div and has the class "widgetBody".
widgetCollapse(domElement) {
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
	// Get the ID and DOM element of the widget to be closed
	const id = this.domFunctions.widgetGetId(widgetElement);
	const widget = document.getElementById(id);

	// If the widget to "close" is a table widget, just hide it.
	if (widget.classList.contains('tableWidget')) {
		widget.hidden = true;
		this.shownTable = null;
		this.activeWidget = null;
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

		if (this.activeWidget) { // If activeNode (the DOM element being dragged) exists
			if (this.activeWidget.offsetTop < target.offsetTop) {  // drag down
				target.parentNode.insertBefore(this.activeWidget, target.nextSibling); // Insert after target
			}
			else { // drag up
				target.parentNode.insertBefore(this.activeWidget, target); // Insert before target
			}
		}

		this.activeNode = null; // Nothing is actively being dragged anymore - the thing that was being dragged was dropped.

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

// Check for support of JS version 6
supportsES6() {
  try {
    new Function("(a = 0) => a");
		const workingBrowsers = [
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36"
			,"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1 Safari/605.1.15"
			,"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15"
		]
		if (workingBrowsers.indexOf(navigator.userAgent) == -1) {
			alert (`While this browser may support JS v6, it has not been tested with this website, and may not work.`);
		}
    return true;
  }
  catch (err) {
		alert (`This browser doesn't support JS v6, and you will likely have some problems running this website. Try using an up-to-date version of Safari or Chrome.`);
    return false;
  }
}

error(message) {
	const err = new Error();
	const line = err.line;
	const col = err.column;
	const URL = err.sourceURL;
	const stack = err.stack;


	alert(`An error has occurred. Details: ${message}\nStack:${stack}`);
}

// Used for testing, UI can be hard coded here to reduce amount of clicking to test code.
// Can be called directly by app.html, or by clicking a single button. Currently empty.
test() {}
}  ///////////////////////////////////////////////////////////////// end class
