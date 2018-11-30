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

  //----------------Main functions - "tables of contents"------------------------

  copyFrom() {
    this.checkDBLocal(this) // pass along a boolean, local, stating whether the user is logged in locally
    .then(function(local){
      if (local) { // If the database is local, keep going; if not, stop
      	this.checkDBEmpty(this) // pass along a boolean, empty, stating whether the local DB is empty
      	.then(this.clearDB) // If the DB isn't empty, ask whether the user wants to clear it
      	.then(function(userCancelled) {
        // userCancelled is undefined if the DB was empty and clearDB was never called,
        // false if the user chose to clear the DB, true if the user chose to cancel
        	if (!userCancelled) { // if userCancelled is undefined or false, keep going; if it's true, stop
        		this.getLatestCL(this) // Get the latest change log from the source database
        		.then(this.setLatestCL) // Create the dataSharePartner node in the destination DB, and store the source's latest CL# there
        		.then(this.getNodesList) // Get list of node types from source database and update progress bar
        		.then(this.getRelsList) // Get list of rel types from source database and update progress bar
        		.then(this.copyNodes) // Repeatedly call downloadNodes and uploadNodes until all nodes have been copied
        		.then(this.copyRels) // Repeatedly call downloadRels and uploadRels until all rels have been copied
            .then(this.done); // Cleanup code which tells the user we're done and resets variables
        	} // end if (user didn't cancel)
        }.bind(this)); // end then function to run after checkDBEmpty function -- the one that continues if the user didn't cancel
      } // end if (user is logged in locally)
    }.bind(this)); // end then function to run after startCopyFrom -- the one that continues if the user is logged in locally
  }

  copyTo() {
    this.checkDestinationEmpty(this)
    .then(function(empty){
      if (empty) {
        this.getLatestCL(this) // Get the latest change log from the source database
        .then(this.setLatestCL) // Create the dataSharePartner node in the destination DB, and store the source's latest CL# there
        .then(this.getNodesList) // Get list of node types from source database and update progress bar
        .then(this.getRelsList) // Get list of rel types from source database and update progress bar
        .then(this.processNodes) // Repeatedly call downloadNodes and uploadNodes until all nodes have been copied
        .then(this.processRels) // Repeatedly call downloadRels and uploadRels until all rels have been copied
        .then(this.done); // Cleanup code which tells the user we're done and resets variables
      }
    }.bind(this))
  }

  restore() {
    this.checkDBEmpty(this)
      .then(function(obj) {
        if (obj.empty) {
          this.getNodeData(obj.copy)
            .then(this.getRelData)
            .then(this.restoreNodes)
            .then(this.restoreRels)
            .then(this.done);
        }
        else {
          alert("Could not proceed because the local database is not empty.");
        }
      }.bind(this));
  }

  backup() {
    this.findNodes(this)
      .then(this.findRels)
      .then(this.backupNodes)
      .then(this.backupRels)
      .then(this.done);
  }

  //------------------Helper functions - used in copy to/from--------------------
  checkDBLocal(copy) {
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

  checkDestinationEmpty(copy) {
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

  deleteNodes(copy) {
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
            copy.deleteNodes(copy).then(function(copy){
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

  getLatestCL(copy) {
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

  setLatestCL(copy) {
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

  clearDB(obj) {
    return new Promise(function (resolve, reject) {

      if (obj.empty) {
        resolve(false);
      }
      else {
        if (confirm("There is already data in the local database; do you want to overwrite it?")) {
          obj.copy.deleteNodes(obj.copy).then(function() {
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

  getNodesList(copy) {
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

  getRelsList(copy) {
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

  copyNodes(obj) {
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
        copy.downloadNodes({"copy":copy, "typeIndex":typeIndex, "minimum":minimum})
        .then(copy.uploadNodes)
        .then(copy.copyNodes)
        .then(function() {
          resolve({"copy":copy});
        });
      }
      else {
        resolve({"copy":copy});
      }
    });
  }

  copyRels(obj) {
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
        copy.downloadRels({"copy":copy, "typeIndex":typeIndex, "minimum":minimum})
        .then(copy.uploadRels)
        .then(copy.copyRels)
        .then(function(copy){
          resolve(copy)
        });
      }
      else {
        resolve(copy);
      }
    });
  }

  downloadNodes(downloadObj) {
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

  uploadNodes(uploadObj) {
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

  downloadRels(downloadObj) {
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

  uploadRels(obj) {
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
          else {
            value = JSON.stringify(value);
          }
          rProperties += `${propName}: ${value}, `;
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

  //------------------Helper functions - used in backup--------------------------

  findNodes(copy) {
    return new Promise(function(resolve, reject){
      copy.progress.innerHTML = "";
      const xhttp = new XMLHttpRequest();

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
          resolve({"nodesDone":nodesDone, "copy":copy});
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "findNodes"}; // query to start the backup process
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server

    });
  }

  findRels(backupObj) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          // Update progress bar and relsDone array...
          const relsDone = [];
          const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
          for (let i = 0; i < results.length; i++) {
            backupObj.copy.progress.innerHTML +=
            `<tr><td>Rel</td><td>${results[i].name}</td><td id="relCount${i}">0</td><td>${results[i].target}</td></tr>`;
            relsDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
          }
          // and send next request
          backupObj.relsDone = relsDone;
          backupObj.index = 0;
          backupObj.minimum = 0;
          resolve(backupObj);
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "findRels"}; // query to find the relations
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server

    });
  }

  backupNodes(backupObj) {
    return new Promise(function(resolve, reject) {
      let copy = backupObj.copy;
      let index = backupObj.index;
      let minimum = backupObj.minimum;
      if (!index) {
        index = 0;
      }
      if (!minimum) {
        minimum = 0;
      }

      if (backupObj.nodesDone.length > index) {
        copy.backupNodeBatch(backupObj)
        .then(copy.backupNodes)
        .then(function() {
          backupObj.index = 0;
          resolve(backupObj);
        });
      }
      else {
        backupObj.index = 0;
        resolve(backupObj);
      }
    });
  }

  backupRels(backupObj) {
    return new Promise(function(resolve, reject) {
      let copy = backupObj.copy;
      let index = backupObj.index;
      let minimum = backupObj.minimum;
      if (!index) {
        index = 0;
      }
      if (!minimum) {
        minimum = 0;
      }

      if (backupObj.relsDone.length > index) {
        copy.backupRelBatch(backupObj)
        .then(copy.backupRels)
        .then(function() {
          resolve(backupObj.copy);
        });
      }
      else {
        resolve(backupObj.copy);
      }
    });
  }

  backupNodeBatch(backupObj) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          // Update progress bar...
          const results = JSON.parse(this.responseText); // object containing numNodes and lastID
          backupObj.nodesDone[backupObj.index].done += results.numNodes;
          document.getElementById(`nodeCount${backupObj.index}`).textContent = backupObj.nodesDone[backupObj.index].done;

          // update variables
          if (backupObj.nodesDone[backupObj.index].done < backupObj.nodesDone[backupObj.index].target) {
            backupObj.minimum = results.lastID;
          }
          else {
            backupObj.index++;
            backupObj.minimum = 0;
          }

          // and send next request
          resolve(backupObj);
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "backupNodes", "name": backupObj.nodesDone[backupObj.index].name, "minimum": backupObj.minimum, "blocksize": backupObj.copy.nodeBlocksize}; // query to start the backup process
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  backupRelBatch(backupObj) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();

      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          // Update progress bar...
          const results = JSON.parse(this.responseText); // object containing numRels and lastID
          backupObj.relsDone[backupObj.index].done += results.numRels;
          document.getElementById(`relCount${backupObj.index}`).textContent = backupObj.relsDone[backupObj.index].done;

          // update variables
          if (backupObj.relsDone[backupObj.index].done < backupObj.relsDone[backupObj.index].target) {
            backupObj.minimum = results.lastID;
          }
          else {
            backupObj.index++;
            backupObj.minimum = 0;
          }

          resolve(backupObj);
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "backupRels", "name": backupObj.relsDone[backupObj.index].name, "minimum": backupObj.minimum, "blocksize": backupObj.copy.relBlocksize}; // query to back up the relations
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  //------------------Helper functions - used in restore-------------------------
  getNodeData(copy) {
    return new Promise(function(resolve, reject) {
      const restoreFolder = document.getElementById('backupSource').value;
      copy.progress.innerHTML = "";

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
          resolve({"nodesDone":nodesDone, "copy":copy});
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "startRestore", "folder":restoreFolder}; // query to start the backup process
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  getRelData(restoreObj) {
    return new Promise(function(resolve, reject) {
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          // Update progress bar and relsDone array...
          const relsDone = [];
          const results = JSON.parse(this.responseText); // array of rel objects, containing name and target.
          for (let i = 0; i < results.length; i++) {
            restoreObj.copy.progress.innerHTML +=
            `<tr><td>Rel</td><td>${results[i].name}</td><td id="relCount_${results[i].name}">0</td><td>${results[i].target}</td></tr>`;
            relsDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
          }
          // and send next request
          restoreObj.relsDone = relsDone;
          resolve(restoreObj);
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "getRelData"}; // query to find the relations
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  restoreNodes(restoreObj) {
    return new Promise(function(resolve, reject){
      if (restoreObj.responseText === "Out of nodes") {
        resolve(restoreObj);
      }
      else {
        restoreObj.copy.restoreNodeBatch(restoreObj)
        .then(restoreObj.copy.restoreNodes)
        .then(function() {
          resolve(restoreObj);
        });
      }
    });
  }

  restoreRels(restoreObj) {
    return new Promise(function(resolve, reject){
      if (restoreObj.responseText === "Out of rels") {
        resolve(restoreObj.copy);
      }
      else {
        restoreObj.copy.restoreRelBatch(restoreObj)
        .then(restoreObj.copy.restoreRels)
        .then(function() {
          resolve(restoreObj.copy);
        });
      }
    });
  }

  restoreNodeBatch(restoreObj) {
    return new Promise(function(resolve, reject){
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          restoreObj.responseText = this.responseText;
            if (this.responseText !== "Out of nodes") {
            // Update progress bar and nodesDone array...
            const results = JSON.parse(this.responseText); // object containing name and number of nodes restored
            const type = restoreObj.nodesDone.find(x => x.name === results.name);
            type.done += results.numNodes;
            document.getElementById(`nodeCount_${results.name}`).textContent = type.done;
          }
          // and send next request
          resolve(restoreObj);
        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "restoreNodes"}; // query to find the relations
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  restoreRelBatch(restoreObj) {
    return new Promise(function(resolve, reject) {
      const xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        // call back function when state of send changes
        if (this.readyState == 4 && this.status == 200) {
          restoreObj.responseText = this.responseText;
          if (this.responseText !== "Out of rels") {
            // Update progress bar and relsDone array...
            const results = JSON.parse(this.responseText); // object containing name and number of relations restored
            const type = restoreObj.relsDone.find(x => x.name === results.name);
            type.done += results.numRels;
            document.getElementById(`relCount_${results.name}`).textContent = type.done;
          }
        // send next request
        resolve(restoreObj);

        } // end if (readystate = 4, status = 200)
      }; // end of callback function

      xhttp.open("POST", "");
      const obj = {"server": "backupNeo4j"};  // create object to send to server
      const query = {"functionName": "restoreRels"}; // query to find the relations
      obj.query = query;

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  //------------------Helper functions - used in multiple contexts---------------
  checkDBEmpty(copy) {
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
      const steps = "MATCH (n) return n limit 1";
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server

      xhttp.send(JSON.stringify(obj));         // send request to server
    });
  }

  done(copy) {
    copy.progress.innerHTML += "Done!";
    copy.source = "";
    copy.destination = "";
  }

  stringEscape(text) {
  	let string = JSON.stringify(text);
  	string = string.substring(1, string.length-1);
    if (string.indexOf("'") > -1) {
      string = string.replace(/'/g, "\\'");
    }
  	return string;
  }
}
