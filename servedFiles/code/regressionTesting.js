class regressionTesting {
  constructor() {
    this.logField = document.getElementById('log'); // DOM element - log field
    this.recording = false; // whether actions are being recorded
    this.recordText = []; // Object storing all recorded actions
    this.playing = false; // whether actions are being replayed continuously
    this.stepThrough = false; // whether actions are being stepped through one at a time
    this.fileRunning = false; // whether a file has already been accessed and is currently being played
    this.playbackObj = []; // Array storing all actions to replay
    this.instruction = 1; // Number of the next action to be replayed by next() - starts at 1 because 0 is processed by play(). Increments when an action is played, resets when Play button is clicked
    this.recordings = 1;
    this.playFiles = 0;
    this.domFunctions = new domFunctions();
    this.regHeader = document.getElementById("regressionHeader");
    this.dragData = {};

    this.playDOM = null;
    this.stepDOM = null;
    this.delayMS = null;
    this.delayOn = null;
    this.linkDiv = null;
  }

  buildRegressionHeader() {
    this.regHeader.setAttribute("hidden", "true");
    this.regHeader.setAttribute("class", "widget");

    this.regHeader.innerHTML = `
    <p>To run the premade scripts, make sure you are working in an empty database, then select ALL scripts and play.
       Due to the widget numbering system, later scripts will NOT run properly unless they are run immediately after
      the earlier ones.</p>
    <p>Number of scripts recorded for this page so far: 0</p>
    <input type="button" id="Record" value="Record" onclick="app.widget('recordToggle', this)">
    Select a playback file: <input type="file" id="playback" multiple="true">
    <input type="button" id="replay" value="Play Remaining Steps" onclick="app.widget('play', this)">
    <input type="button" id="stepThrough" value="Play Next Step" onclick="app.widget('play', this)">
    <input type="checkbox" id="delayOn" checked="true" onclick="app.widget('delayToggle', this)">Use delay when replaying
    <input type="number" id="delayMS" value="500">Enter delay (in milliseconds)
    <p id="dlink"></p><hr></div>`;

    this.playDOM = document.getElementById("replay");
    this.stepDOM = document.getElementById("stepThrough");
    this.delayMS = document.getElementById("delayMS");
    this.delayOn = document.getElementById("delayOn");
    this.linkDiv = document.getElementById("dlink");

    const obj = {};
    obj.object = app;
    obj.method = 'hideRegression';
    const regressionButton = document.getElementById('regressionButton');
    obj.args = [regressionButton];
    app.login.doOnLogout.push(obj);
  }

  log(message){
  	if (this.logField && !this.logField.hidden) { // If log field exists and is visible
      const line = document.createElement('p');
      const text = document.createTextNode(message);
      line.appendChild(text);
  		this.logField.appendChild(line);
  	}
  } // end log method

  // toggle log on off
  logToggle(button){
  	log = document.getElementById('log');
  	log.hidden = !log.hidden;
  	if (!log.hidden) {
  		// clear Log
  		while (log.hasChildNodes()) {
        log.removeChild(log.firstChild);
      }
  		this.log("logging started");
  		button.value = "Stop Logging";
  	} else {
  		button.value = "Start Logging";
  	}
  } // end logToggle method

  // Can log when any text field is changed. Called by text fields that don't already have an onchange or onblur event
  logText(textBox) {
  	const obj = {};
    if (textBox.id) { // If the text box is outside any widget and has its own ID, record its ID.
      obj.id = textBox.id;
    }
    else {
  	  obj.id = this.domFunctions.widgetGetId(textBox); // If it has no ID, it should be inside a widget. Record its parent's ID and its IDR.
      obj.idr = textBox.getAttribute("idr");
    }
  	obj.value = textBox.value;
  	obj.action = "blur";
  	this.log(JSON.stringify(obj));
  	this.record(obj);
  } // end logText method

  // Logs when the search criterion for an input field changes
  logSearchChange(selector) { // selector is the dropdown which chooses among "S", "M" or "E" for strings, and "<", ">", "<=", ">=" or "=" for numbers.
    const obj = {};
  	obj.id = this.domFunctions.widgetGetId(selector);
  	obj.idr = selector.getAttribute("idr");
  	obj.value = selector.options[selector.selectedIndex].value;
  	obj.action = "click";
  	this.log(JSON.stringify(obj));
  	this.record(obj);
  } // end logSearchChange method

  record(message) {
  	if (this.recording) { // If actions are being recorded, add the new message to the recording
      this.recordText.push(message);
  	}

  	if (this.playing) { // If a recording is being replayed, play the next step, after optionally waiting a specified time
      if (this.delayOn.checked) {
        setTimeout(this.next, this.delayMS.value, this); // wait for the specified number of milliseconds
      }
      else {
        this.next(this);
      }
  	}

    if (this.stepThrough) { // If a recording is being stepped through, check whether the next step includes an action. If not, go ahead and play it
      if (this.playbackObj.length > this.instruction) { // If the next step exists...
        if (!('action' in this.playbackObj[this.instruction])) { // and doesn't include an action...
          this.next(this); // then play it rather than waiting for the user to click "next".
        }
      }
    }
  } // end record method

  // toggle record on and off
  recordToggle(button){
    if (this.recording) { // If the page was recording
  		button.value = "Record";
  		const text = JSON.stringify(this.recordText);
  		if (this.playing || this.stepThrough) { // If actions were being recorded during playback

        const playbackText = JSON.stringify(this.playbackObj);
  			if (text == playbackText) {
  				alert ("Success!");
  			}
  			else {
  				alert ("Failure! Original recording: " + playbackText + "; replay recording: " + text);
  			}
  		}
  		else { // If actions were being recorded in order to save them
        const para = document.createElement('p');
  			const uriContent = "data:application/octet-stream," + encodeURIComponent(text);
        const link = document.createElement('a');
        link.href = uriContent;
        const now = new Date();
        const numberDate = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}`
        link.download = `Recording_${numberDate}.txt`;
        const message = `Download recording #${this.recordings++}  `;
        const linkText = document.createTextNode(message);
        link.appendChild(linkText);
        para.appendChild(link);
        this.linkDiv.appendChild(para);
  		}
  		// reset
  		this.recordText = [];
  		// this.recordedStep = 1; // Not sure what's going on here - this variable is never used in this class
  	}
    else { // If the page was not recording
  		button.value = "Stop Recording";
  	}
  	this.recording = !this.recording;
  } // end recordToggle method

  // This could be more robust - if you choose the wrong file or the file is corrupted, it might exist and even contain JSON, but not be usable.
  // I'll have to spend some time thinking about the best way of error-checking. But for now, as long as we DON'T choose the wrong file, it should be OK.

  play(button) { // Reads a file, sets playback variables and plays back the FIRST recorded action
    if (this.fileRunning) { // if a file is already running
      if (button == this.stepDOM) { // if play was called by the stepThrough button
        this.stepThrough = true;
        this.playing = false;
      }
      else { // if play was called by play button
        this.playing = true;
        this.stepThrough = false;
      }
      this.next(this);
    }
    else { // if a file is NOT already running
    	const fileButton = document.getElementById("playback");
    	let replayText;

    	if ('files' in fileButton && fileButton.files.length > this.playFiles) { // If there's another file to play back
        alert("Now Playing: " + fileButton.files[this.playFiles].name);

        if ((!button && this.stepThrough) || button == this.stepDOM) { // If play was called by the stepThrough button, or called by next when stepping through
      		this.playing = false;
          this.stepThrough = true;
        }
        else if ((!button && this.playing) || button == this.playDOM) { // If play was called by the play button, or called by next when playing
          this.playing = true;
          this.stepThrough = false;
        }

    		this.instruction = 1;
    		this.playbackObj = []; // Reset playback variables
        const regression = this;

    		if (!this.recording) {
    			this.recordToggle(document.getElementById("Record")); // make sure app is recording
    		}

    		const myFile = fileButton.files[this.playFiles];
     		const fileReader = new FileReader();
    		fileReader.onload = function(fileLoadedEvent){ // ANONYMOUS INNER FUNCTION STARTS HERE! Cannot use 'this' to refer to regressionTesting object here!
    			replayText = fileLoadedEvent.target.result;
    			regression.playbackObj = JSON.parse(replayText);
    			regression.processPlayback(regression.playbackObj[0]); // process the first instruction
    		} // end anonymous function
    		fileReader.readAsText(myFile, "UTF-8");
        this.fileRunning = true;
        this.playFiles++; // go on to the next file
    	} // end if (file exists)

      else { // There are no more files to play. Reset.
        this.playFiles = 0; // Reset playFiles
        this.playing = false;
        this.stepThrough = false;
      }

    	if (fileButton.files.length == 0) { // If there were no files uploaded
    		alert ("Select a file first!")
    	}
    } // end if (file is not already playing)
  } // end play method

  next(regression) { // Replays the next recorded action from a file, if it exists. If not, checks for another file.
    if (regression.playbackObj.length > regression.instruction) {
      regression.processPlayback(regression.playbackObj[regression.instruction]);
      regression.instruction++;
  	}
  	else { // Playback is finished. Check for success, then try to play next file
      regression.recordToggle(document.getElementById("Record"));
      regression.fileRunning = false;
      regression.play();
  	}
  } // end next method

  processPlayback(instructionObj) { // takes a single instruction object as argument, plays it
    if ('id' in instructionObj) { // Can only replay an action or set a value if this instruction defines an element, using an id and maybe an idr
  	  const id = instructionObj.id;
    	let element = document.getElementById(id);

    	if ('idr' in instructionObj) {
    		element = this.domFunctions.getChildByIdr(element, instructionObj.idr);
    	}

    	if ('value' in instructionObj) {
    		element.value = instructionObj.value;
    	}

      if ('action' in instructionObj) {
        const evnt = new Event(instructionObj.action);
        if (instructionObj.action == "keydown" && 'key' in instructionObj) { // keydown events have a "key" value that determines WHICH key was pressed
          evnt.key = instructionObj.key;
        }
        if (instructionObj.action == "dragstart" || instructionObj.action == "drop") { // I'm going to TRY to make a mock dataTransfer object.
          evnt.dataTransfer = {};

          evnt.dataTransfer.setData = function(type, data) {
            app.regression.dragData[type] = data;
          }
          evnt.dataTransfer.getData = function(type) {
            return app.regression.dragData[type];
          }
        }
        element.dispatchEvent(evnt);
      } // end if (the instruction contains an action)
    } // end if (the instruction has an id)
  } // end processPlayback method

  clearAll(app) {
  	if (confirm("This will clear ALL DATA from the database and remove ALL WIDGETS from the webpage. Are you sure you want to do this?")) {
      // Remove widgets
      app.clearWidgets();

  		// Remove nodes and relationships
      const obj = {};
      obj.return = false;

      app.sendQuery(obj, "deleteNode", "Clearing database");

      // const queryObject = {"server": "CRUD", "function": "deleteNode", "query": obj, "GUID": app.login.userGUID};
      // const request = JSON.stringify(queryObject);
      //
      // const update = app.startProgress(null, "Clearing database", request.length);
      //
      // const xhttp = new XMLHttpRequest();
      //
      // xhttp.onreadystatechange = function() {
      //   if (this.readyState == 4 && this.status == 200) {
      //     app.stopProgress(null, update, this.responseText.length);
      //   }
      // };
      //
      // xhttp.open("POST","");
      // xhttp.send(request);         // send request to server

  		// reset all variables to ensure same state every time "Clear All" is chosen
  		app.idCounter = 0; // reset ID counter
  		if (this.recording) {
  			this.recordToggle(document.getElementById("Record")); // make sure app is not recording
  		}
    //  		log = document.getElementById('log');
  		if (!this.logField.hidden) { // If the log is active...
  			this.logToggle(document.getElementById("LogButton")); // deactivate it
  		}
  	} // end if (user confirms they want to clear all)
  } // end clearAll method

  delayToggle(checkBox) {
    if(checkBox.checked) {
      this.delayMS.disabled=false;
    }
    else {
      this.delayMS.disabled=true;
    }
  }
} // end class
