class REST {
  constructor() {
    this.userRequest = 0;
    this.requestDetails = [];
    this.serverRequests = [];
  }

  startUserRequest(text, DOMelement) {
    let topWidget = null;

    while (DOMelement) {
  		if (DOMelement.classList.contains("widget")) {
  			topWidget = DOMelement;
  		}
  		DOMelement = DOMelement.parentElement;
  	}

    if (topWidget) {
      const div = app.domFunctions.getChildByIdr(topWidget, "requestDetails");
      if (div) {
        div.innerHTML = "";
      }

      const span = app.domFunctions.getChildByIdr(topWidget, "requestName");
      if (span) {
        span.innerHTML = "";
        const request = document.createElement("SPAN");
        const status = document.createTextNode(`${this.userRequest}) ${text}`);
        const timer = document.createElement("SPAN");
        timer.innerHTML = ":  0 ms";
        timer.setAttribute('idr', 'timer');
        request.setAttribute('id', `requestRow${this.userRequest}`);
        request.appendChild(status);
        request.appendChild(timer);
        span.appendChild(request);

        const toggleDetails = app.domFunctions.getChildByIdr(topWidget, "showRequestDetails");
        toggleDetails.classList.remove("hidden");

        this.requestDetails[this.userRequest] = [];
        this.serverRequests[this.userRequest] = 0;
      }
    }
    return this.userRequest++; // Return and then increment
  }

  // DOMelement is usually the whole widget, but it will also work if it's an element from within the widget.
  // Use it to work up to the top-level widget, then give it a class of "requestRunning".
  startProgress(DOMelement, text, request, userRequest, serverRequest) {
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
  		const header = topWidget.getElementsByClassName('widgetHeader')[0]; // There should be only one header
  			header.classList.add("grayedOut");

      // Add a row for the server request to the details div
      const detailsDiv = app.domFunctions.getChildByIdr(header, "requestDetails");
      const detailRow = document.createElement('P');
      detailRow.setAttribute('idr', `requestDetail${userRequest}.${serverRequest}`);
      detailRow.innerHTML = `${userRequest}.${serverRequest}) ${text} <span idr = 'serverTimer${serverRequest}'>:  0 ms</span>`
      detailsDiv.appendChild(detailRow);

  		const cancel = app.domFunctions.getChildByIdr(topWidget, 'cancelButton');
  		cancel.classList.remove('hidden');

      let update = null;

      const row = document.getElementById(`requestRow${userRequest}`);
      const serverTimer = app.domFunctions.getChildByIdr(detailRow, `serverTimer${serverRequest}`);
      const userTimer = app.domFunctions.getChildByIdr(row, 'timer');

      // The server action starts now - no need to subtract
      const serverStartTime = performance.now();
      // Subtract the time already elapsed from now to get the effective start time for the user action
      const userStartTime = serverStartTime - parseInt(userTimer.textContent.slice(3));

      update = setInterval(function () {
  			const currTime = performance.now();
        const serverElapsedTime = currTime - serverStartTime;
  			const userElapsedTime = currTime - userStartTime;
        serverTimer.innerHTML = `:  ${Math.round(serverElapsedTime)} ms`;
  			userTimer.innerHTML = `:  ${Math.round(userElapsedTime)} ms`;
  		}, 10);

  		row.setAttribute("update", update);

      const requestObj = {"timer":update};
      recordStartTime = Date.now();
      requestObj.startTime = recordStartTime;

      const id = topWidget.getAttribute('id');
  		const JSinstance = app.widgets[id];
  		if (JSinstance) {
  			if (JSinstance.requests == undefined) { // make sure there's a requests array
  				JSinstance.requests = [];
  			}
  			JSinstance.requests.push(requestObj);
  		}

      this.requestDetails[userRequest][serverRequest] = {
        "userRequest":userRequest,
        "serverRequest":serverRequest,
        "description":text,
        "startTime":recordStartTime,
        "requestLength":request.length,
        "request":app.stringEscape(request)
      };

      if (app.login.sessionGUID && app.login.browserGUID) { // if a session is ongoing, record the request
        requestObj.userRequest = userRequest;
        requestObj.serverRequest = serverRequest;

    	  const obj = {};
    	  obj.from = {"type":"M_Session", "properties":{"M_GUID":app.login.sessionGUID}};
    	  obj.rel = {"type":"Request",
                   "properties": JSON.parse(JSON.stringify(this.requestDetails[userRequest][serverRequest]))};
    	  obj.to = {"type":"M_Browser", "properties":{"M_GUID":app.login.browserGUID}};

    	  const xhttp = new XMLHttpRequest();

    	  xhttp.open("POST","");
    	  const queryObject = {"server": "CRUD", "function": "createRelation", "query": obj, "GUID": "upkeep", "token":app.login.sessionGUID};
    	  xhttp.send(JSON.stringify(queryObject));         // send request to server
    	} // end if (a session is ongoing)
    	return requestObj; // Info stopProgress will need later
  	} // end if (topWidget exists)
  }

  stopProgress(DOMelement, obj, response, userRequest, serverRequest) {
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

    // The JS object (instance of widgetNode, widgetTableNodes, etc.) which is associated with the top widget
  	let JSinstance = null;

  	if (topWidget) {
  		const id = topWidget.getAttribute('id');
  		JSinstance = app.widgets[id];
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

      const duration = Date.now() - requests[i].startTime;
      this.requestDetails[userRequest][serverRequest].duration = duration;
      this.requestDetails[userRequest][serverRequest].result = result;

      if (response) {
        this.requestDetails[userRequest][serverRequest].responseLength = response.length;

        if (response !== "timeout") {
          response = JSON.parse(response);
        }
        this.requestDetails[userRequest][serverRequest].response = response; // store this (unstringified) in object but not (for now) in DB
      }

  		// If a session is running, and the count is defined (meaning that this request was logged when it began),
  		// then update the record of that request now.
  		if (app.login.sessionGUID && app.login.browserGUID
        && requests[i].userRequest !== undefined && requests[i].serverRequest !== undefined) {

  			const obj = {};
  			obj.from = {"type":"M_Session", "properties":{"M_GUID":app.login.sessionGUID}};
  			obj.rel = {"type":"Request", "properties":{"userRequest":requests[i].userRequest, "serverRequest":requests[i].serverRequest}};
  			obj.to = {"type":"M_Browser", "properties":{"M_GUID":app.login.browserGUID}};
  			obj.changes = [
  					{"item":"rel", "property":"duration", "value":duration},
  					{"item":"rel", "property":"endResult", "value":result},
  			];

  			if (response) { // if the response exists - meaning if this was called after a response was received, not by a cancel button
  				obj.changes.push({"item":"rel", "property":"responseLength", "value":response.length});
  			}

  			const xhttp = new XMLHttpRequest();

  			xhttp.open("POST","");
  			const queryObject = {"server": "CRUD", "function": "changeRelation", "query": obj, "GUID": "upkeep", "token":app.login.sessionGUID};
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

  		const cancel = app.domFunctions.getChildByIdr(topWidget, 'cancelButton');
  		cancel.classList.add('hidden');
  	}
  }

  sendQuery(obj, CRUD, description, userRequest, DOMelement, GUID, url, onComplete, ...args) {
  	if (!GUID) {
  		GUID = app.getProp(app, "login", "userGUID");
  	}
  	if (!GUID) {
  		GUID = "upkeep";
  	}

  	if (!url) {
  		url = "";
  	}

    const serverRequest = this.serverRequests[userRequest]++; // store current value and increment

  	const queryObject = {"server": "CRUD", "function": CRUD, "query": obj, "GUID": GUID, "token":app.login.sessionGUID};
  	const request = JSON.stringify(queryObject);

  	const xhttp = new XMLHttpRequest();
  	const update = this.startProgress(DOMelement, description, request, userRequest, serverRequest);
  	const REST = this;
    const logout = app.login.logout.bind(app.login);

  	xhttp.onreadystatechange = function() {
  		if (this.readyState == 4 && this.status == 200) {
        if (this.responseText === "timeout") {
          REST.stopProgress(DOMelement, update, this.responseText, userRequest, serverRequest);
          alert ("Sorry, your session has timed out.");
          logout(true);
        }
        else {
    			const data = JSON.parse(this.responseText);
    			REST.stopProgress(DOMelement, update, this.responseText, userRequest, serverRequest);

          // Put caching code here

    			if (onComplete) {
    				onComplete(data, userRequest, ...args);
    			}
        }
  		} // end if (readyState and status OK)
  	}; // end anonymous function

  	xhttp.open("POST", url);
  	xhttp.send(request);         // send request to server
  }
}
