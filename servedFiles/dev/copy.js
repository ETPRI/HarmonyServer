class copy {
  constructor() {
    this.nodes = [];
    this.rels = [];
    this.nodesDone = [];
    this.relsDone = [];
    this.nodeBlocksize = 100;
    this.relBlocksize = 20;
    this.progress = document.getElementById('progress');

    this.source = "";
    this.destination = "";
    this.latestCL = -1;
  }


  // Example of what main function using promise code might look like

  copyFromPromise() {
    this.checkDBLocalPromise(this) // pass along a boolean, local, stating whether the user is logged in locally
    .then(function(local){
      if (local) { // If the database is local, keep going; if not, stop
      	this.checkDBEmptyPromise(this) // pass along a boolean, empty, stating whether the local DB is empty
      	.then(this.clearDBPromise) // If the DB isn't empty, ask whether the user wants to clear it
      	.then(function(userCancelled) {
        // userCancelled is undefined if the DB was empty and clearDB was never called,
        // false if the user chose to clear the DB, true if the user chose to cancel
        	if (!userCancelled) { // if userCancelled is undefined or false, keep going; if it's true, stop
        		this.getLatestCLPromise(this) // Get the latest change log from the source database
        		.then(this.setLatestCLPromise) // Create the dataSharePartner node in the destination DB, and store the source's latest CL# there
        		.then(this.getNodesListPromise) // Get list of node types from source database and update progress bar
        		.then(this.getRelsListPromise) // Get list of rel types from source database and update progress bar
        		.then(this.processNodesPromise) // Repeatedly call downloadNodes and uploadNodes until all nodes have been copied
        		.then(this.processRelsPromise) // Repeatedly call downloadRels and uploadRels until all rels have been copied
            .then(this.donePromise); // Cleanup code which tells the user we're done and resets variables
        	} // end if (user didn't cancel)
        }.bind(this)); // end then function to run after checkDBEmpty function -- the one that continues if the user didn't cancel
      } // end if (user is logged in locally)
    }.bind(this)); // end then function to run after startCopyFrom -- the one that continues if the user is logged in locally
  }

  copyToPromise() {
    this.checkDestinationEmptyPromise(this)
    .then(function(empty){
      if (empty) {
        this.getLatestCLPromise(this) // Get the latest change log from the source database
        .then(this.setLatestCLPromise) // Create the dataSharePartner node in the destination DB, and store the source's latest CL# there
        .then(this.getNodesListPromise) // Get list of node types from source database and update progress bar
        .then(this.getRelsListPromise) // Get list of rel types from source database and update progress bar
        .then(this.processNodesPromise) // Repeatedly call downloadNodes and uploadNodes until all nodes have been copied
        .then(this.processRelsPromise) // Repeatedly call downloadRels and uploadRels until all rels have been copied
        .then(this.donePromise); // Cleanup code which tells the user we're done and resets variables
      }
    }.bind(this))
  }

  checkDBLocalPromise(copy) {
    return new Promise(function(resolve, reject) {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        copy.source = `http://${document.getElementById('copySource').value}`;
        resolve(true);
      }
      else {
        alert("Not logged in locally!");
        copy.source = "";
        resolve(false);
      }
    });
  }

  checkDBEmptyPromise(copy) {
    return new Promise(function (resolve, reject) {
      const xhttp = new XMLHttpRequest();

      xhttp.onload = function() {
        // call back function when state of send changes
        const results = JSON.parse(this.responseText);
        let obj = {"copy":copy};
        if (results.length == 0) {
          obj.empty = true;
        }
        else {
          obj.empty = false;
        }
        resolve(obj);
      };

      xhttp.open("POST", "");
      const steps = "MATCH (n) return n limit 1"
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  checkDestinationEmptyPromise(copy) {
    return new Promise(function(resolve, reject) {
      copy.destination = `http://${document.getElementById('copyDestination').value}`;
      var xhttp2 = new XMLHttpRequest();

      xhttp2.onload = function() {
        // call back function when state of send changes
        const results = JSON.parse(this.responseText);
        if (results.length == 0) {
          resolve(true);
        }
        else {
          alert("Could not proceed because the target database is not empty.");
          this.destination = ""; // reset destination
          resolve(false);
        }
      };

      xhttp2.open("POST", this.destination);
      const steps = "MATCH (n) return n limit 1"
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp2.send(JSON.stringify(obj));         // send request to server

    });
  }

  // asks whether to clear the local DB; clears it if the user agrees; resolves with true if the user cancelled.
  clearDBPromise(obj) {
    return new Promise(function (resolve, reject) {

      if (obj.empty) {
        resolve(false);
      }
      else {
        if (confirm("There is already data in the local database; do you want to overwrite it?")) {
          obj.copy.deleteNodesPromise(obj.copy).then(function() {
            resolve(false);
          }); // resolves with false if the user continued (rather than cancel)
        }
        else {
          obj.copy.source = "";
          resolve(true);
        }
      }
    });
  }

  deleteNodesPromise(copy) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();

      xhttp.onload = function() {
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          if (data[0].count.low === 0) {
            resolve(copy);
          }
          else {
            // Calls itself recursively while there are more nodes to delete.
            // Should resolve this call once the next one is finished.
            copy.deleteNodesPromise(copy).then(function(copy){
              resolve(copy);
            });
          }
        }
      }

      xhttp.open("POST", "");
      // Deletes in batches to avoid freezing
      const steps = "MATCH (n) with n limit 1000 detach delete n return count(n) as count";
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  getLatestCLPromise(copy) {
    return new Promise(function(resolve, reject) {
      const xhttp2 = new XMLHttpRequest();

      xhttp2.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          const data = JSON.parse(this.responseText);
          copy.latestCL = -1; // Default value in case anything goes wrong with the query
          if (data.length > 0) {
            copy.latestCL = data[0].max.low;
          }
          resolve(copy);
        }
      };

      let steps = `match (n:M_ChangeLog) return coalesce(max(n.number), 0) as max`;
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp2.open("POST", copy.source);
      xhttp2.send(JSON.stringify(obj));         // send request to server
    });
  }

  setLatestCLPromise(copy) {
    return new Promise(function(resolve, reject){
      const xhttp2 = new XMLHttpRequest();

      xhttp2.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          resolve(copy);
        }
      };

      const obj = {};
      obj.node = {"type":"M_DataSharePartner", "properties":{"IPaddress":copy.source}, "merge":true};
      obj.changes = [{"property":"localMinCount", "value":0}, {"property":"remoteMinCount", "value":copy.latestCL}];

      const query = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID":"initialize"};  // create object to send to server

      xhttp2.open("POST", copy.destination);
      xhttp2.send(JSON.stringify(query));         // send request to server
    });
  }

  getNodesListPromise(copy) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          copy.nodes = JSON.parse(this.responseText);
          // clear progress bar before starting
          copy.progress.innerHTML = "";
          for (let i = 0; i < copy.nodes.length; i++) {
            copy.nodesDone[i] = 0;
            copy.progress.innerHTML +=
            `<tr><td>Node</td><td>${copy.nodes[i].L}</td><td id="nodeCount${i}">0</td><td>${copy.nodes[i].count.low}</td></tr>`;
          }
          resolve(copy);
        }
      };

      xhttp.open("POST", copy.source);
      const steps = `MATCH (n) where n.M_CreateChangeLog <= ${copy.latestCL}
                     and not labels(n)[0] in['M_ChangeLog', 'M_Browser', 'M_Session', 'M_DataSharePartner']
                     unwind labels(n) as L RETURN distinct L, count(L) as count`;
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  getRelsListPromise(copy) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          copy.rels = JSON.parse(this.responseText);
          for (let i = 0; i < copy.rels.length; i++) {
            copy.relsDone[i] = 0;
            copy.progress.innerHTML +=
            `<tr><td>Relation</td><td>${copy.rels[i].type}</td><td id="relCount${i}">0</td><td>${copy.rels[i].count.low}</td></tr>`;
          }
          resolve({"copy":copy});
        }
      };

      xhttp.open("POST", copy.source);
      const steps =   `MATCH (a)-[r]->(b) where r.M_CreateChangeLog <= ${copy.latestCL}
                       and not type(r) in['User', 'Request']
                       return distinct type(r) as type, count(r) as count order by type`;
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  processNodesPromise(obj) {
    return new Promise(function(resolve, reject) {
      let copy = obj.copy;
      let typeIndex = obj.typeIndex;
      let minimum = obj.minimum;
      if (!typeIndex) {
        typeIndex = 0;
      }
      if (!minimum) {
        minimum = 0;
      }

      if (copy.nodes.length > typeIndex) {
        copy.downloadNodesPromise({"copy":copy, "typeIndex":typeIndex, "minimum":minimum})
        .then(copy.uploadNodesPromise)
        .then(copy.processNodesPromise)
        .then(function() {
          resolve({"copy":copy});
        });
      }
      else {
        resolve({"copy":copy});
      }
    });
  }

  processRelsPromise(obj) {
    return new Promise(function(resolve, reject) {
      let copy = obj.copy;
      let typeIndex = obj.typeIndex;
      let minimum = obj.minimum;
      if (!typeIndex) {
        typeIndex = 0;
      }
      if (!minimum) {
        minimum = 0;
      }

      if (copy.rels.length > typeIndex) {
        copy.downloadRelsPromise({"copy":copy, "typeIndex":typeIndex, "minimum":minimum})
        .then(copy.uploadRelsPromise)
        .then(copy.processRelsPromise)
        .then(function(copy){
          resolve(copy)
        });
      }
      else {
        resolve(copy);
      }
    });
  }

  downloadNodesPromise(downloadObj) {
    return new Promise(function(resolve, reject){
      const copy = downloadObj.copy;
      const typeIndex = downloadObj.typeIndex;
      const minimum = downloadObj.minimum;
      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          downloadObj.data = JSON.parse(this.responseText);
          // call next function
          resolve(downloadObj);
        }
      };

      xhttp.open("POST", copy.source);
      let where = `where n.M_CreateChangeLog <= ${copy.latestCL}`;
      if (minimum > 0) {
        where += ` and ID(n) > ${minimum}`;
      }
      const steps = `match (n: ${copy.nodes[typeIndex].L}) ${where} return n order by ID(n) limit ${copy.nodeBlocksize}`;
      const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  uploadNodesPromise(uploadObj) {
    return new Promise(function(resolve, request) {
      const copy = uploadObj.copy;
      let typeIndex = uploadObj.typeIndex;
      let minimum = uploadObj.minimum;
      const data = uploadObj.data;

      const xhttp2 = new XMLHttpRequest();

      xhttp2.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          // Update progress bar
          copy.nodesDone[typeIndex] += data.length;
          const count = document.getElementById(`nodeCount${typeIndex}`);
          count.textContent = copy.nodesDone[typeIndex];

          // call next function - either downloading more nodes, or downloading rels
          if (copy.nodesDone[typeIndex] < copy.nodes[typeIndex].count.low) {  // If there are more nodes of this type to download
            // Get the LAST item from the results and retrieve its ID
            const last = data[copy.nodeBlocksize - 1];
            minimum = last.n.identity.low;
          }
          else {
            minimum = 0;
            typeIndex++; // Move on to the next node type (or to rels if there are no more types)
          }
          resolve({"copy":copy, "typeIndex":typeIndex, "minimum":minimum});
        }
      };

      xhttp2.open("POST", copy.destination);

      let steps = "create ";
      for (let i = 0; i < data.length; i++) { // for every node...
        const props = data[i].n.properties;
        let properties = "";
        for (let propName in props) { // loop through all properties and create text to set them...
          // If the property is an object with a low and high value, take the low one
          let value = props[propName];
          if (typeof value.low !== "undefined") {
            value = value.low;
          }
          else if (typeof value !== "string") {
            const stringify = JSON.stringify(value);
            const stringEscape = copy.stringEscape(stringify);
            value = `"${copy.stringEscape(JSON.stringify(value))}"`;
          }
          else { // If the type IS string, don't bother stringifying it
            value = `"${copy.stringEscape(value)}"`;
          }
          properties += `${propName}: ${value}, `;
        }
        if (properties.length > 0) {
          properties = properties.slice(0, properties.length - 2); // remove the last ", "
        }

        let nodeText = `(n${i}:${copy.nodes[typeIndex].L} {${properties}}), `; // Crate text to make the node
        steps += nodeText; // add to the request
      }
      if (steps.length > 7) { // If at least one node needs to be added - which SHOULD always be the case
        steps = steps.slice(0, steps.length - 2);
        const obj = {"server": "neo4j", "query": steps};  // create object to send to server
        xhttp2.send(JSON.stringify(obj));         // send request to server
      }
      else { // this should never happen - but may as well prepare for it
        alert("Tried to upload an empty set of nodes");
      }
    });
  }

  downloadRelsPromise(downloadObj) {
    return new Promise(function(resolve, reject){
      const copy = downloadObj.copy;
      const typeIndex = downloadObj.typeIndex;
      const minimum = downloadObj.minimum;

      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          downloadObj.data = JSON.parse(this.responseText);

          // call next function
          resolve(downloadObj);
        }
      };

      xhttp.open("POST", copy.source);
      let where = `where r.M_CreateChangeLog <= ${copy.latestCL}`;
      if (minimum > 0) {
        where += ` and ID(r) > ${minimum}`;
      }

      const steps = `match (a)-[r:${copy.rels[typeIndex].type}]->(b) ${where} return a, b, r order by ID(r) limit ${copy.relBlocksize}`;
      const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server

    });
  }

  uploadRelsPromise(obj) {
    return new Promise(function(resolve, reject) {
      const copy = obj.copy;
      const data = obj.data;
      let typeIndex = obj.typeIndex;
      let minimum = obj.minimum;

      const xhttp2 = new XMLHttpRequest();

      xhttp2.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          // Update progress bar
          copy.relsDone[typeIndex] += data.length;
          const count = document.getElementById(`relCount${typeIndex}`);
          count.textContent = copy.relsDone[typeIndex];

          if (copy.relsDone[typeIndex] < copy.rels[typeIndex].count.low) { // If there are more relations of this type to download
            // Get the LAST item from the results and retrieve its ID
            const last = data[copy.relBlocksize-1];
            minimum = last.r.identity.low;
          }
          else {
            minimum = 0;
            typeIndex++;
          }
          resolve({"copy":copy, "typeIndex":typeIndex, "minimum":minimum});
        }
      };
      xhttp2.open("POST", copy.destination);

      let nodeText = "";
      let relText = "";

      for (let i = 0; i < data.length; i++) { // for every relation...
        nodeText += `(a${i}:${data[i].a.labels[0]} {M_GUID:'${data[i].a.properties.M_GUID}'}), (b${i}:${data[i].b.labels[0]} {M_GUID:'${data[i].b.properties.M_GUID}'}), `

        const rProps = data[i].r.properties;
        let rProperties = "";
        for (let propName in rProps) { // loop through all properties of the relation and create text to set them...
          let value = rProps[propName];

          if (typeof value.low !== "undefined") {
            value = JSON.stringify(value.low);
          }
          else if (typeof value !== "string") {
            value = JSON.stringify(value);
          }
          rProperties += `${propName}: '${copy.stringEscape(value)}', `;
        }
        if (rProperties.length > 0) {
          rProperties = rProperties.slice(0, rProperties.length - 2); // remove the last ", "
        }
        relText += `(a${i})-[r${i}:${data[i].r.type} {${rProperties}}]->(b${i}), `
      }

      if (nodeText.length > 0 && relText.length > 0) { // Assuming that at least one relation between two nodes was found
        nodeText = nodeText.slice(0, nodeText.length - 2);
        relText = relText.slice(0, relText.length - 2);
        let steps = `match ${nodeText} create ${relText}`;
        const obj = {"server": "neo4j", "query": steps};  // create object to send to server
        xhttp2.send(JSON.stringify(obj));         // send request to server
      }
      else { // this should never happen - but may as well prepare for it
        alert("Tried to upload an empty set of relations");
      }
    });
  }

  donePromise(copy) {
    copy.progress.innerHTML += "Done!";
    copy.source = "";
    copy.destination = "";
  }
  //-----------------------------------Preliminary copy/restore code-----------------------------
  /* Overall copyFrom algorithm:
    Make sure user is logged in locally; if not, cancel
    Check whether local database is empty
      If so, move on to startNodes
      If not, ask if the user wants to clear existing data.
        If they say no, cancel
        If they say yes, clear the DB and move on to startNodes
    Get list of node types and their counts
    Get list of rel types and their counts
    Repeatedly download nodes from source and upload them to destination until all are processed
    Repeatedly download rels from source and upload them to destination until all are processed
  */

  startCopyFrom() { // calls checkLocalDB iff logged in locally; sets this.source
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      this.source = `http://${document.getElementById('copySource').value}`;
      this.checkLocalDB();
    }
    else {
      alert("Not logged in locally!");
      this.source = "";
    }
  }

  checkLocalDB() { // warns the user and allows them to cancel if data will be erased; calls clearDB or startNodes
    var xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onload = function() {
      // call back function when state of send changes
      const results = JSON.parse(this.responseText);
      if (results.length == 0) {
        copy.getLatestCL();
      }
      else {
        if (confirm("There is already data in the local database; do you want to overwrite it?.")) {
          copy.clearDB();
        }
        else {
          this.source = ""; // cancel and reset source
        }
      }
    };

    xhttp.open("POST", "");
    const steps = "MATCH (n) return n limit 1"
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  clearDB() {// clears the local DB and calls startNodes
    var xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onload = function() {
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        if (data[0].count.low === 0) {
          copy.getLatestCL();
        }
        else {
          copy.clearDB(); // keep calling itself recursively while there are more nodes to delete
        }
      }
    }

    xhttp.open("POST", "");
    const steps = "MATCH (n) with n limit 1000 detach delete n return count(n) as count"; // Deletes in batches to avoid freezing
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  startCopyTo() { // calls startNodes iff the destination DB is empty; sets this.destination
    this.destination = `http://${document.getElementById('copyDestination').value}`;
    var xhttp2 = new XMLHttpRequest();
    const copy = this;

    xhttp2.onload = function() {
      // call back function when state of send changes
      const results = JSON.parse(this.responseText);
      if (results.length == 0) {
        copy.getLatestCL();
      }
      else {
        alert("Could not proceed because the target database is not empty.");
        this.destination = ""; // reset destination
      }
    };

    xhttp2.open("POST", this.destination);
    const steps = "MATCH (n) return n limit 1"
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp2.send(JSON.stringify(obj));         // send request to server
  }

  startRestore() { // calls getNodeData iff the local DB is empty
    var xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onload = function() {
      // call back function when state of send changes
      const results = JSON.parse(this.responseText);
      if (results.length == 0) {
        copy.getNodeData();
      }
      else alert("Could not proceed because the local database is not empty.");
    };
    xhttp.open("POST", "");
    const steps = "MATCH (n) return n limit 1"
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  //----------------------------------Main copy code---------------------------------------

  // Get the latest changeLog number from the source - the DB being copied from.
  // Then call setLatestCL to record this in the destination.
  getLatestCL() {
    const xhttp2 = new XMLHttpRequest();
    const copy = this;

    xhttp2.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        const data = JSON.parse(this.responseText);
        copy.latestCL = -1; // Default value in case anything goes wrong with the query
        if (data.length > 0) {
          copy.latestCL = data[0].max.low;
        }
        copy.setLatestCL();
      }
    };

    let steps = `match (n:M_ChangeLog) return coalesce(max(n.number), 0) as max`;
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp2.open("POST", this.source);
    xhttp2.send(JSON.stringify(obj));         // send request to server
  }

  // Create or update the DataSharePartner node in the destination referring to the source. Then start copying.
  setLatestCL() {
    const xhttp2 = new XMLHttpRequest();
    const copy = this;

    xhttp2.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        copy.startNodes();
      }
    };

    const obj = {};
    obj.node = {"type":"M_DataSharePartner", "properties":{"IPaddress":this.source}, "merge":true};
    obj.changes = [{"property":"localMinCount", "value":0}, {"property":"remoteMinCount", "value":this.latestCL}];

    const query = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID":"initialize"};  // create object to send to server

    xhttp2.open("POST", this.destination);
    xhttp2.send(JSON.stringify(query));         // send request to server
  }

  // Gets a list of node labels from the source DB, leaving out nodes we don't want to copy.
  // Then stores the list, updates the progress bar, and calls startRels.
  startNodes() {
    var xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        copy.nodes = JSON.parse(this.responseText);
        // clear progress bar before starting
        copy.progress.innerHTML = "";
        for (let i = 0; i < copy.nodes.length; i++) {
          copy.nodesDone[i] = 0;
          copy.progress.innerHTML +=
          `<tr><td>Node</td><td>${copy.nodes[i].L}</td><td id="nodeCount${i}">0</td><td>${copy.nodes[i].count.low}</td></tr>`;
        }
        copy.startRels();
      }
    };

    xhttp.open("POST", this.source);
    const steps = `MATCH (n) where n.M_CreateChangeLog <= ${this.latestCL}
                   and not labels(n)[0] in['M_ChangeLog', 'M_Browser', 'M_Session', 'M_DataSharePartner']
                   unwind labels(n) as L RETURN distinct L, count(L) as count`;
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  // Gets a list of relation labels from the source DB, leaving out relations we don't want to copy.
  // Then stores the list, updates the progress bar, and calls downloadNodes.
  startRels() {
    const xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        copy.rels = JSON.parse(this.responseText);
        for (let i = 0; i < copy.rels.length; i++) {
          copy.relsDone[i] = 0;
          copy.progress.innerHTML +=
          `<tr><td>Relation</td><td>${copy.rels[i].type}</td><td id="relCount${i}">0</td><td>${copy.rels[i].count.low}</td></tr>`;
        }

        // If there are nodes to download, start downloading them
        if (copy.nodes.length > 0) {
          copy.downloadNodes(0, 0);
        }

        // If not, there can't be relations either (no nodes for them to be between), so skip to the end
        else {
          copy.progress.innerHTML += "Done!";
          copy.source = "";
          copy.destination = "";
        }
      }
    };

    xhttp.open("POST", this.source);
    const steps =   `MATCH (a)-[r]->(b) where r.M_CreateChangeLog <= ${this.latestCL}
                     and not type(r) in['User', 'Request']
                     return distinct type(r) as type, count(r) as count order by type`;
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  // downloads up to [nodeBlocksize] nodes of a given type, whose ID exceeds the ID of the last item downloaded
  // and which haven't been created since the copy process started, from the source.
  // Then calls uploadNodes to store them in the destination.
  downloadNodes(typeIndex, minimum) {
    var xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        const results = JSON.parse(this.responseText);

        // call next function
        copy.uploadNodes(typeIndex, minimum, results);
      }
    };

    xhttp.open("POST", this.source);
    let where = `where n.M_CreateChangeLog <= ${this.latestCL}`;
    if (minimum > 0) {
      where += ` and ID(n) > ${minimum}`;
    }
    const steps = `match (n: ${copy.nodes[typeIndex].L}) ${where} return n order by ID(n) limit ${copy.nodeBlocksize}`;
    const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  // Uploads the data from downloadNodes to the destination. Then calls downloadNodes, or if the nodes are done, downloadRels.
  uploadNodes(typeIndex, minimum, data) {
    var xhttp2 = new XMLHttpRequest();
    const copy = this;

    xhttp2.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar
        copy.nodesDone[typeIndex] += data.length;
        const count = document.getElementById(`nodeCount${typeIndex}`);
        count.textContent = copy.nodesDone[typeIndex];

        // call next function - either downloading more nodes, or downloading rels
        if (copy.nodesDone[typeIndex] < copy.nodes[typeIndex].count.low) {  // If there are more nodes of this type to download
          // Get the LAST item from the results and retrieve its ID
          const last = data[copy.nodeBlocksize - 1];
          minimum = last.n.identity.low;
        }
        else {
          minimum = 0;
          typeIndex++; // Move on to the next node type, if there is a next one
        }

        // If there are more nodes to download, keep downloading them
        if (typeIndex < copy.nodes.length) {
          copy.downloadNodes(typeIndex, minimum);
        }

        // If not, if there are any rels to download, start downloading them
        else if (copy.rels.length > 0) {
          copy.downloadRels(0, 0);
        }

        // If the nodes are finished and there are no rels, skip to the end
        else {
          copy.progress.innerHTML += "Done!";
          copy.source = "";
          copy.destination = "";
        }
      }
    };
    xhttp2.open("POST", this.destination);

    let steps = "create ";
    for (let i = 0; i < data.length; i++) { // for every node...
      const props = data[i].n.properties;
      let properties = "";
      for (let propName in props) { // loop through all properties and create text to set them...
        // If the property is an object with a low and high value, take the low one
        let value = props[propName];
        if (typeof value.low !== "undefined") {
          value = value.low;
        }
        else if (typeof value !== "string") {
          const stringify = JSON.stringify(value);
          const stringEscape = copy.stringEscape(stringify);
          value = `"${copy.stringEscape(JSON.stringify(value))}"`;
        }
        else { // If the type IS string, don't bother stringifying it
          value = `"${copy.stringEscape(value)}"`;
        }
        properties += `${propName}: ${value}, `;
      }
      if (properties.length > 0) {
        properties = properties.slice(0, properties.length - 2); // remove the last ", "
      }

      let nodeText = `(n${i}:${copy.nodes[typeIndex].L} {${properties}}), `; // Crate text to make the node
      steps += nodeText; // add to the request
    }
    if (steps.length > 7) { // If at least one node needs to be added - which SHOULD always be the case
      steps = steps.slice(0, steps.length - 2);
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server
      xhttp2.send(JSON.stringify(obj));         // send request to server
    }
    else { // this should never happen - but may as well prepare for it
      app.error("Tried to upload an empty set of nodes");
    }
  }

  // downloads up to [relBlockSize] relations of a given type, whose ID exceeds the ID of the last item downloaded
  // and which haven't been created since the copy process started, from the source.
  // Then calls uploadRels to store them in the destination.
  downloadRels(typeIndex, minimum) {
    const xhttp = new XMLHttpRequest();
    const copy = this;

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        const results = JSON.parse(this.responseText);

        // call next function
        copy.uploadRels(typeIndex, minimum, results);
      }
    };

    xhttp.open("POST", this.source);
    let where = `where r.M_CreateChangeLog <= ${this.latestCL}`;
    if (minimum > 0) {
      where += ` and ID(r) > ${minimum}`;
    }

    const steps = `match (a)-[r:${copy.rels[typeIndex].type}]->(b) ${where} return a, b, r order by ID(r) limit ${copy.relBlocksize}`;
    const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  // uploads the data from downloadRels to the destination. Then calls downloadRels if there are more rels.
  // If there are no more rels, tells the user it's done and resets this.source and this.destination.
  uploadRels(typeIndex, minimum, data) {
    const xhttp2 = new XMLHttpRequest();
    const copy = this;

    xhttp2.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar
        copy.relsDone[typeIndex] += data.length;
        const count = document.getElementById(`relCount${typeIndex}`);
        count.textContent = copy.relsDone[typeIndex];

        if (copy.relsDone[typeIndex] < copy.rels[typeIndex].count.low) { // If there are more relations of this type to download
          // Get the LAST item from the results and retrieve its ID
          const last = data[copy.relBlocksize-1];
          minimum = last.r.identity.low;
        }
        else {
          minimum = 0;
          typeIndex++;
        }

        // call next function - either downloading more rels, or ending the copy process
        if (typeIndex < copy.rels.length) {
          copy.downloadRels(typeIndex, minimum);
        }
        else { // done with copying; alert the user and reset variables
          copy.progress.innerHTML += "Done!";
          copy.source = "";
          copy.destination = "";
        }
      }
    };
    xhttp2.open("POST", this.destination);

    let nodeText = "";
    let relText = "";

    for (let i = 0; i < data.length; i++) { // for every relation...
      nodeText += `(a${i}:${data[i].a.labels[0]} {M_GUID:'${data[i].a.properties.M_GUID}'}), (b${i}:${data[i].b.labels[0]} {M_GUID:'${data[i].b.properties.M_GUID}'}), `

      const rProps = data[i].r.properties;
      let rProperties = "";
      for (let propName in rProps) { // loop through all properties of the relation and create text to set them...
        let value = rProps[propName];

        if (typeof value.low !== "undefined") {
          value = JSON.stringify(value.low);
        }
        else if (typeof value !== "string") {
          value = JSON.stringify(value);
        }
        rProperties += `${propName}: '${copy.stringEscape(value)}', `;
      }
      if (rProperties.length > 0) {
        rProperties = rProperties.slice(0, rProperties.length - 2); // remove the last ", "
      }
      relText += `(a${i})-[r${i}:${data[i].r.type} {${rProperties}}]->(b${i}), `
    }
    if (nodeText.length > 0 && relText.length > 0) { // Assuming that at least one relation between two nodes was found
      nodeText = nodeText.slice(0, nodeText.length - 2);
      relText = relText.slice(0, relText.length - 2);
      let steps = `match ${nodeText} create ${relText}`;
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server
      xhttp2.send(JSON.stringify(obj));         // send request to server
    }
    else { // this should never happen - but may as well prepare for it
      app.error("Tried to upload an empty set of relations");
    }
  }
  //------------------------------------Backup code--------------------------

  startBackup(copy) {
    this.progress.innerHTML = "";
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // clear progress bar before starting
        copy.progress.innerHTML = "";
        // Update progress bar and nodesDone array...
        const nodesDone = [];
        const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Node</td><td>${results[i].name}</td><td id="nodeCount${i}">0</td><td>${results[i].target}</td></tr>`;
          nodesDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        copy.findRels(nodesDone, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "findNodes"}; // query to start the backup process
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  findRels(nodesDone, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and relsDone array...
        const relsDone = [];
        const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Rel</td><td>${results[i].name}</td><td id="relCount${i}">0</td><td>${results[i].target}</td></tr>`;
          relsDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        const progress = {"nodesDone":nodesDone, "relsDone":relsDone};
        copy.backupNodes(0,0, progress, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "findRels"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  backupNodes(index, minimum, progress, copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar...
        const results = JSON.parse(this.responseText); // object containing numNodes and lastID
        progress.nodesDone[index].done += results.numNodes;
        document.getElementById(`nodeCount${index}`).textContent = progress.nodesDone[index].done;

        // update variables
        if (progress.nodesDone[index].done < progress.nodesDone[index].target) {
          minimum = results.lastID;
        }
        else {
          index++;
          minimum = 0;
        }

        // and send next request
        if (index < progress.nodesDone.length) {
          copy.backupNodes(index, minimum, progress, copy);
        }
        else {
          copy.backupRels(0, 0, progress, copy);
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "backupNodes", "name": progress.nodesDone[index].name, "minimum": minimum, "blocksize": this.nodeBlocksize}; // query to start the backup process
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  backupRels(index, minimum, progress, copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar...
        const results = JSON.parse(this.responseText); // object containing numRels and lastID
        progress.relsDone[index].done += results.numRels;
        document.getElementById(`relCount${index}`).textContent = progress.relsDone[index].done;

        // update variables
        if (progress.relsDone[index].done < progress.relsDone[index].target) {
          minimum = results.lastID;
        }
        else {
          index++;
          minimum = 0;
        }

        // and send next request
        if (index < progress.relsDone.length) {
          copy.backupRels(index, minimum, progress, copy);
        }
        else {
          copy.progress.innerHTML += "Done!"
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "backupRels", "name": progress.relsDone[index].name, "minimum": minimum, "blocksize": this.relBlocksize}; // query to back up the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  //------------------------------------Main restore code-------------------------

  getNodeData() {
    const restoreFolder = document.getElementById('backupSource').value;
    this.progress.innerHTML = "";
    const copy = this;

    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and nodesDone array...
        const nodesDone = [];
        const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
        // clear progress bar before starting
        copy.progress.innerHTML = "";
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Node</td><td>${results[i].name}</td><td id="nodeCount_${results[i].name}">0</td><td>${results[i].target}</td></tr>`;
          nodesDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        copy.getRelData(nodesDone, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "startRestore", "folder":restoreFolder}; // query to start the backup process
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  getRelData(nodesDone, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and relsDone array...
        const relsDone = [];
        const results = JSON.parse(this.responseText); // array of rel objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Rel</td><td>${results[i].name}</td><td id="relCount_${results[i].name}">0</td><td>${results[i].target}</td></tr>`;
          relsDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        const progress = {"nodesDone":nodesDone, "relsDone":relsDone};
        copy.restoreNodes(progress, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "getRelData"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  restoreNodes(progress, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        if (this.responseText == "Out of nodes") { // signal to move on to rels
          copy.restoreRels(progress, copy);
        }
        else {
          // Update progress bar and nodesDone array...
          const results = JSON.parse(this.responseText); // object containing name and number of nodes restored
          const type = progress.nodesDone.find(x => x.name === results.name);
          type.done += results.numNodes;
          document.getElementById(`nodeCount_${results.name}`).textContent = type.done;

          // and send next request
          copy.restoreNodes(progress, copy);
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "restoreNodes"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  restoreRels(progress, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        if (this.responseText == "Out of rels") { // signal to move on to rels
          copy.progress.innerHTML += "Done!";
        }
        else {
          // Update progress bar and nodesDone array...
          const results = JSON.parse(this.responseText); // object containing name and number of relations restored
          const type = progress.relsDone.find(x => x.name === results.name);
          type.done += results.numRels;
          document.getElementById(`relCount_${results.name}`).textContent = type.done;

          // and send next request
          copy.restoreRels(progress, copy);
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "restoreRels"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  //------------------------------------Helper functions---------------------

  startProgress() {
    this.progress.innerHTML = "";
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodesDone[i] = 0;
      this.progress.innerHTML +=
      `<tr><td>Node</td><td>${this.nodes[i].L}</td><td id="nodeCount${i}">0</td><td>${this.nodes[i].count.low}</td></tr>`;
    }

    for (let i = 0; i < this.rels.length; i++) {
      this.relsDone[i] = 0;
      this.progress.innerHTML +=
      `<tr><td>Relation</td><td>${this.rels[i].type}</td><td id="relCount${i}">0</td><td>${this.rels[i].count.low}</td></tr>`;
    }

  }

  stopProgress() {
    this.progress.innerHTML += "Done!";
  }

  // Escapes special character in a string. Stringifying it and then removing the outer quotes is a good shortcut.
  stringEscape(text) {
  	let string = JSON.stringify(text);
  	string = string.substring(1, string.length-1);
    if (string.indexOf("'") > -1) {
      string = string.replace(/'/g, "\\'");
    }
  	return string;
  }
}
