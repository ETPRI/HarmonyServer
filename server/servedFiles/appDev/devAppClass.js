class devAppClass {
  constructor() {
    this.widgets   = {}; // store widgets as they are created, remove when closed
  	this.idCounter = 0;  // init id counter - used get getElementById, is the id of the widget

  	this.activeWidget 	= null; // widget being dragged

  	this.domFunctions 	= null;
  	this.login 					= null;

  	this.doOnResize			= [];

  	window.onerror = function(msg, url, line, col, err) {
  		app.error(msg, err);
  	};
  }

  buildApp() {
  	// Create instances of other classes needed to run the page. Called here because some of them require app to exist
  	// before their constructors can run.
  	this.domFunctions 	= new domFunctions();
  	this.login 					= new widgetLogin();
  	this.REST						= new REST();

  	// Add the login div to the list of widgets
  	this.widgets.loginDiv = this.login;

  	// Make the workspace visible only when a user is logged in, and remove all widgets when the user logs out.
  	this.workSpace = document.getElementById("workSpace");
  	this.workSpace.classList.add("hidden");
  	this.login.viewLoggedIn.push(this.workSpace);

  	document.addEventListener("keydown", this.keyPressed.bind(this));

  	// Check for metadata and add it if needed
  	this.checkMetaData();

  	// Run any test code currently in app
  	this.test();
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

  		while (children.length > 0) {
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
  		const widgetList = document.getElementById("widgetsList");
  		if (widgetsList) {
  			const entry = app.domFunctions.getChildByIdr(widgetList, id);
  			if (entry) {
  				widgetList.removeChild(entry);
  			}
  		}
  	}

  	// log
  	if (this.regression) {
  		const obj = {};
  		obj.id = id;
  		obj.idr = widgetElement.getAttribute("idr");
  		obj.action = "click";
  		this.regression.log(JSON.stringify(obj));
  		this.regression.record(obj);
  	}
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

  // Removes all widgets other than the login div and regression header from both the screen and the widgets array
  // To add: Also clear the widget list of everything except the login widget, and minimize the debug and regression headers
  clearWidgets() {
  	const login = document.getElementById('loginDiv');
  	const regHeader = document.getElementById('regressionHeader');
  	for (let id in this.widgets) { // For every widget...
  		if (id != "loginDiv" && id != "regressionHeader") { // (except for the login div and regression header)...

  			// delete  html2 from page, assuming it exists and isn't inside a protected widget
  			const widget = document.getElementById(id);
  			if (widget && !(login && login.contains(widget)) && !(regHeader && regHeader.contains(widget))) {
  				widget.parentElement.removeChild(widget);
  			}

  			// Remove widget objects from widgets object, unless the DOM element still exists AND is in a protected widget
  			if (!widget || (!(login && login.contains(widget)) && !(regHeader && regHeader.contains(widget)))) {
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

  // Escapes special characters in a string. Stringifying it and then removing the outer quotes is a good shortcut.
  stringEscape(text) {
  	let string = JSON.stringify(text);
  	string = string.substring(1, string.length-1);
  	return string;
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

  getProp(o, ...args) {
      while (o && args.length > 0) {
          o = o[args.shift()];
      }
      return args.length ? null : o;
  }
}
