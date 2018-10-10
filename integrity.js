module.exports = class integrity {
  /* NOTE: Integrity items to add later:
  Verify that no item has more than one owner
  Verify that metadata exists? (drawback is I'd have to duplicate code from metadata class,
    or rethink the logic of how the client gets that metadata)

    If I move ensuring that metadata exists onto the server, to run when the server starts, then I don't NEED that check in app -
    the metadata will DEFINITELY exist and be up-to-date by the time app runs - so I can take that part out and just include
    a query to GET the metadata. I may not even need a metadata class in that case - just an object, stored in app, whose
    properties can be queried. And if I did it that way, then I could handcraft the queries to create the metadata objects,
    instead of running them through createNode. I could add constraints at the same time.

  Verify that if there are multiple changeLogs referencing the same item GUID:
    There is (at most?) one "create" changelog
    The "create" changelog (if it exists?) has the lowest number
    There is at most one "delete" changelog
    The "delete" changelog, if it exists, has the highest number
    If there is a "delete" changelog then no node or rel with that GUID exists
  */

  constructor(driver, uuid, stringEscape, defaultUpdate) {
    this.uuid = uuid;
    this.driver = driver;
    this.stringEscape = stringEscape;
    this.update = defaultUpdate; // Flag determining whether to FIX problems or just ALERT the user to them.
    this.changeCount = null; // No other functions can run until this has a value - assigned by getChangeCount
    this.checkConstraints(); // Makes sure the DB has all the constraints it's supposed to, then calls getChangeCount
  }

  // These first four need to run FIRST because running the others without constraints,
  // or without an up-to-date changeCount, could introduce errors.

  checkConstraints() { // Get a list of all metadata nodes - which should be all node types in the DB
    console.log ("Searching for metadata to use for constraints...");
    const query = "MATCH (n:M_MetaData) return n.name as name";
    let nodes = [];
    const integrity = this;

    const session = this.driver.session();
    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          console.log("Metadata node for constraint found...");
          nodes.push(record._fields[0]);
        },
        onCompleted: function () {
          console.log("Search for metadata nodes for constraints is finished.");
          integrity.matchConstraints(nodes);
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

  matchConstraints(names) {
    // Build an array of constraints that should exist - each metadata node should have a unique M_GUID, and each changeLog should have a unique number.
    // I wasn't actually able to ensure that every node of ANY kind has a unique M_GUID, but this will do for a start.
    let desiredConstraints = [`CONSTRAINT ON ( m_changelog:M_ChangeLog ) ASSERT m_changelog.number IS UNIQUE`,
                       `CONSTRAINT ON ( m_changelog:M_ChangeLog ) ASSERT exists(m_changelog.number)`];
    for (let i = 0; i < names.length; i++) {
      desiredConstraints.push(`CONSTRAINT ON ( ${names[i].toLowerCase()}:${names[i]} ) ASSERT ${names[i].toLowerCase()}.M_GUID IS UNIQUE`);
      desiredConstraints.push(`CONSTRAINT ON ( ${names[i].toLowerCase()}:${names[i]} ) ASSERT exists(${names[i].toLowerCase()}.M_GUID)`);
    }

    // Search for existing constraints
    const query = "call db.constraints";
    let existingConstraints = [];
    const integrity = this;

    const session = this.driver.session();
    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          existingConstraints.push(record._fields[0]);
        },
        onCompleted: function () {
          // Build a new array of constraints which SHOULD exist, but don't
          const neededConstraints = desiredConstraints.filter(x => existingConstraints.indexOf(x) < 0);
          let fixText = "";
          if (integrity.update) {
            fixText = "; attempting to add constraint...";
          }
          for (let i = 0; i < neededConstraints.length; i++) {
            console.log(`Missing constraint found: ${neededConstraints[i]}${fixText}`);
          }

          if (neededConstraints.length > 0 && integrity.update) { // If constraints are missing and we are correcting problems, then create new constraints
            integrity.createConstraints(neededConstraints);
          }
          else {
            integrity.getChangeCount(); // Run this as soon as constraints are finished
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

  createConstraints(neededConstraints) {
    if (neededConstraints.length > 0) { // while there are more constraints to create. Doing it this way should emulate synchronous code, letting me know when I'm done.
      const constraint = neededConstraints.pop();
      const query = `CREATE ${constraint}`;
      const integrity = this;

      const session = this.driver.session();

      session
        .run(query)
        .subscribe({
          onCompleted: function () {
            integrity.createConstraints(neededConstraints);
            session.close();
          },
          onError: function (error) {
            console.log(error);
          }
      });
    }
    else { // when there are no more constraints to add, call getChangeCount
      this.getChangeCount();
    }
  }

  getChangeCount() {
    const session = this.driver.session();
    let query = `match (n:M_ChangeLog) return coalesce(max(n.number), 0) as max`;
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          integrity.changeCount = record._fields[0];
        },
        onCompleted: function () {
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

//-----------------------------------------------------------------------------

  all() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "all");
      return;
    }

    this.missingNodeGUIDS();
    this.missingRelGUIDS();
    this.checkMetaDataFields();
    this.verifyCalendars();
    this.verifyLoginTables();
    this.uniqueNodeGUIDS();
    this.verifyWidgetNodes();
  }

  tryAgain(object, methodName, ...args) {
    object[methodName](...args);
  }

//-----------------------------------------------------------------------------

  missingNodeGUIDS() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "missingNodeGUIDS");
      return;
    }

    console.log("Checking for missing node GUIDS...");
    let query = "match (n) where not exists(n.M_GUID) return n";

    const session = this.driver.session();
    var result = [];
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          result.push(obj);
          console.log(`Found node with missing GUID. Type: ${obj.n.labels[0]}. Name (if applicable): ${obj.n.properties.name}`);
        },
        onCompleted: function () {
          if (result.length > 0 && integrity.update == true) {
            integrity.assignNodeGUIDS(result);
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  assignNodeGUIDS(data) {
    console.log("Assigning node GUIDS...")
    let nodes = "match ";
    let where = "where ";
    let set = "set ";
    let create = "create ";

    for (let i = 0; i < data.length; i++) {
      nodes += `(n${i}), `;
      where += `ID(n${i}) = ${data[i].n.identity.low} and `;
      let nodeUUID = this.uuid();
      let changeUUID = this.uuid();
      set += `n${i}.M_GUID = '${nodeUUID}', `;
      create += `(change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                                   item_GUID:n${i}.M_GUID, user_GUID:'integrity', M_GUID:'${changeUUID}',
                                   action:'change', attribute:'M_GUID', value:'${nodeUUID}'}), `
    }

    nodes = nodes.slice(0, nodes.length - 2);
    where = where.slice(0, where.length - 5);
    set = set.slice(0, set.length - 2);
    create = create.slice(0, create.length - 2);

    const query = `${nodes} ${where} ${set} ${create}`;

    const session = this.driver.session();

    session
      .run(query)
      .subscribe({
        onCompleted: function () {
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

//-----------------------------------------------------------------------------

  missingRelGUIDS() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "missingRelGUIDS");
      return;
    }

    console.log ("Checking for missing relation GUIDS...");
    let query = "match (a)-[r]->(b) where not exists(r.M_GUID) return a, b, r";

    const session = this.driver.session();
    var result = [];
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          result.push(obj);
          console.log(`Found relation with missing GUID. Type:${obj.r.type}, from ${obj.a.properties.name}:${obj.a.labels[0]} to ${obj.b.properties.name}:${obj.b.labels[0]}`);
        },
        onCompleted: function () {
          if (result.length > 0 && integrity.update == true) {
            integrity.assignRelGUIDS(result);
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  assignRelGUIDS(data) {
    console.log("Assigning relation GUIDS...")
    let rels = "match ";
    let where = "where ";
    let set = "set ";
    let create = "create ";

    for (let i = 0; i < data.length; i++) {
      rels += `()-[r${i}]->(), `;
      where += `ID(r${i}) = ${data[i].r.identity.low} and `;
      let nodeUUID = this.uuid();
      let changeUUID = this.uuid();
      set += `r${i}.M_GUID = '${nodeUUID}', `;
      create += `(change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                                   item_GUID:r${i}.M_GUID, user_GUID:'integrity', M_GUID:'${changeUUID}',
                                   action:'change', attribute:'M_GUID', value:'${nodeUUID}'}), `

    }

    rels = rels.slice(0, rels.length - 2);
    where = where.slice(0, where.length - 5);
    set = set.slice (0, set.length - 2);
    create = create.slice (0, create.length - 2);

    const query = `${rels} ${where} ${set} ${create}`;

    const session = this.driver.session();

    session
      .run(query)
      .subscribe({
        onCompleted: function () {
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

//-----------------------------------------------------------------------------
  checkMetaDataFields() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "checkMetaDataFields");
      return;
    }

    console.log("Checking metadata...");

    const session = this.driver.session();
    const integrity = this;

    let nodes = [];
    let fields = [];

    const query = "MATCH (n:M_MetaData) return n.name, n.fields";
    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          nodes.push(record._fields[0]);
          fields.push(record._fields[1]);
        },
        onCompleted: function () {
          console.log(`${nodes.length} node types found.`);
          for (let i = 0; i < nodes.length; i++) {
            integrity.getKeys(nodes[i], JSON.parse(fields[i]));
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

  getKeys(node, fields) {
    const session = this.driver.session();
    const integrity = this;

    let keys = [];

    const query = `MATCH (p:${node}) unwind keys(p) as key RETURN distinct key`;
    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          keys.push(record._fields[0]);
        },
        // at this point, we have a keys array which includes all keys found for this node type,
        // and a fields object which should contain a key for every field. If it doesn't, then that key needs to be added.
        // So go through all the keys from the DB and add any that are missing to fields.
        onCompleted: function () {
          let mismatch = false;
          let updateText = "";
          if (integrity.update) {
            updateText = "; adding now";
          }
          for (let i = 0; i < keys.length; i++) {
            if (!(keys[i] in fields) && keys[i].slice(0,2) !== 'M_') { // If this key is missing from the fields object, and isn't metadata
              fields[keys[i]] = {label: keys[i]}; // assume its name is also its label
              console.log (`Mismatch! Node type ${node} was missing key ${keys[i]}${updateText}.`);
              mismatch = true;
            }
          }
          if (mismatch) {
            if (integrity.update) {
              integrity.updateFields(node, fields);
            }
          }
          else {
            console.log (`Node type ${node} has no mismatches.`);
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

  updateFields(node, fields) {
    const session = this.driver.session();
    const integrity = this;

    let query = `MATCH (m:M_MetaData {name:"${node}"}) set m.fields = "${this.stringEscape(JSON.stringify(fields))}"
                 create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                          item_GUID:m.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                          action:'change', attribute:'fields', value:m.fields})`;
    session
      .run(query)
      .subscribe({
        onCompleted: function () {
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

//-----------------------------------------------------------------------------
  verifyCalendars() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "verifyCalendars");
      return;
    }

    console.log("Checking for existence of calendars...");
    const calendars = [{"name":"dummy", "description":"dummy calendar"}];
    const query = `match (c:calendar) return c`;

    const session = this.driver.session();
    const integrity = this;
    let result = [];

    session
      .run(query)
      .subscribe({
        onNext: function(record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          result.push(obj);
        },
        onCompleted: function () {
          // Go through every calendar in the calendars array and verify that there is exactly one matching node.
          // If there are no matching nodes, alert the user and add if "update" is turned on.
          // If there are multiple matching nodes, alert the user and do nothing - there's no simple fix there.
          for (let i = 0; i < calendars.length; i++) {
            let matches = JSON.parse(JSON.stringify(result)); // simple way to make a deep copy
            for (let prop in calendars[i]) {
              matches = matches.filter(x=>x.c.properties[prop] == calendars[i][prop]);
            }

            let fixText = "";
            if (matches.length == 0) {
              if (integrity.update) {
                fixText = "; adding now...";
                integrity.addCalendar(calendars[i]);
              }
              console.log(`Calendar '${calendars[i].name}' was not found${fixText}`);
            }
            else if (matches.length > 1) {
              if (integrity.update) {
                fixText = "; this cannot be automatically fixed.";
              }
              console.log(`Multiple copies of calendar '${calendars[i].name}' found${fixText}`);
            }
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

  addCalendar(calendarObj) {
    const GUID = this.uuid();
    let changeLogs = `, (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                          item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                          action:'create', label:'calendar'})`;

    let propString = `M_GUID: "${GUID}", `;
    for (let prop in calendarObj) {
      propString += `${prop}:"${calendarObj[prop]}", `;
      changeLogs += `, (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                            item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                            action:'change', attribute: '${prop}', value:'${calendarObj[prop]}'})`;
    }
    if (propString.length > 0) {
      propString = ` {${propString.slice(0, propString.length - 2)}}`;
    }
    const query = `create (c:calendar${propString})${changeLogs}`;

    const session = this.driver.session();
    session
      .run(query)
      .subscribe({
        onCompleted: function() {
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

//-----------------------------------------------------------------------------
  verifyLoginTables() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "verifyLoginTables");
      return;
    }

    console.log("Checking for existence of login tables...");
    const query = "match (t:M_LoginTable) return t";

    const session = this.driver.session();
    const integrity = this;
    let unfixedErrors = 0;
    let result = [];

    session
      .run(query)
      .subscribe({
        onNext: function(record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          result.push(obj);
        },
        onCompleted: function () {
          let tables = ["Admin", "User"];
          for (let i = 0; i < tables.length; i++) {
            let table = result.filter(x => x.t.properties.name == tables[i]);
            if (table.length == 0) {
              let fixText = "";
              if (integrity.update) {
                fixText = "; adding now...";
                integrity.addLoginTable(tables[i]);
              }
              console.log(`${tables[i]} table not found${fixText}`);
            }
            else if (table.length == 1 && tables[i] == "Admin") { // If the table in question was the admin table, and it exists
              integrity.verifyAdmin(); // go ahead and check whether there are any admins
            }
            else if (table.length > 1) {
              let fixText = "";
              unfixedErrors++;
              if (integrity.update) {
                fixText = "This cannot be automatically fixed.";
              }
              console.log(`Multiple copies of ${tables[i]} table found. ${fixText}`);
            }
          }

          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
    });
  }

  addLoginTable(name) {
    const GUID = this.uuid();
    const query = `create (t:M_LoginTable {name:"${name}", M_GUID:"${GUID}"}),
                          (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                            item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                            action:'create', label:"M_LoginTable"}),
                          (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                            item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                            action:'change', attribute:'name', value:t.name})`;
    const session = this.driver.session();
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onCompleted: function() {
          if (name == "Admin") { // If we just created the admin table, can now check for existence of admins
            integrity.verifyAdmin();
          }
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

  verifyAdmin() {
    let query = `match (t:M_LoginTable {name:"Admin"})
                  optional match (u:people)-[:Permissions]-(t)
                  optional match (a:tempAdmin)-[:Permissions]-(t)
                  return count(u) as userCount, count(a) as tempCount`;

    const session = this.driver.session();
    const integrity = this;
    let numAdmins = 0;
    let numTempAdmins = 0;

    session
      .run(query)
      .subscribe({
        // there should be only one record, containing the number of real admins and number of tempAdmins.
        onNext: function(record) {
          numAdmins = record._fields[0];
          numTempAdmins = record._fields[1];
        },
        onCompleted: function() {
          if (numAdmins == 0 && numTempAdmins == 0) { // If there are no admins and no temp admin
            let fixText = "";
            if (integrity.update) {
              fixText = "; creating temporary admin node...";
              integrity.createTempAdmin();
            }
            console.log(`No admin accounts found${fixText}`);
          }
          else if (numAdmins >0 && numTempAdmins > 0) { // If there are real admins and the temp admin still exists
            let fixText = "";
            if (integrity.update) {
              fixText = "; deleting..."
              integrity.deleteTempAdmin();
            }
            console.log(`Temporary admin account is no longer needed but still exists${fixText}`);
          }

          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

  createTempAdmin() {
    let nodeGUID = this.uuid();
    let relGUID = this.uuid();
    let query = `match (t:M_LoginTable {name:"Admin"})
                 create (a:tempAdmin {name:"Temporary Admin Account", M_GUID:"${nodeGUID}"})
                   -[:Permissions {username:"admin", password:"admin", M_GUID:"${relGUID}"}]->(t),
                 (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                   item_GUID:"${nodeGUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                   action:'create', label:'tempAdmin'}),
                 (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                   item_GUID:"${nodeGUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                   action:'change', attribute:'name', value:'Temporary Admin Account'}),
                 (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                   item_GUID:"${relGUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                   action:'create', label:'Permissions'}),
                 (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                   item_GUID:"${relGUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                   action:'change', attribute:'username', value:'admin'}),
                 (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                   item_GUID:"${relGUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
                   action:'change', attribute:'password', value:'admin'})`;

    const session = this.driver.session();

    session
      .run(query)
      .subscribe({
        onCompleted: function() {
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

  deleteTempAdmin() {
    let query = `match (a:tempAdmin {name:"Temporary Admin Account"}) with a, a.M_GUID as GUID detach delete a
                 create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                 item_GUID:GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                 action:'delete'})`;

    const session = this.driver.session();

    session
      .run(query)
      .subscribe({
        onCompleted: function() {
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

//-----------------------------------------------------------------------------
  uniqueNodeGUIDS() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "uniqueNodeGUIDS");
      return;
    }

    console.log("Checking for uniqueness of GUIDs...");
    let query = `match (a), (b) where a<>b and a.M_GUID = b.M_GUID return distinct a.M_GUID`;
    const session = this.driver.session();
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function(record) {
          let fixText = "";
          if (this.update) {
            fixText = "; this cannot be automatically fixed."
          }
          console.log(`Warning: GUID ${record._fields[0]} is attached to multiple nodes${fixText}`);
        },
        onCompleted: function() {
          integrity.uniqueRelGUIDS();
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

  uniqueRelGUIDS() {
    let query = `match ()-[a]->(), ()-[b]->() where a<>b and a.M_GUID = b.M_GUID return distinct a.M_GUID`;
    const session = this.driver.session();
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function(record) {
          let fixText = "";
          if (this.update) {
            fixText = "; this cannot be automatically fixed."
          }
          console.log(`Warning: GUID ${record._fields[0]} is attached to multiple relations${fixText}`);
        },
        onCompleted: function() {
          integrity.uniqueMixedGUIDS();
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

  uniqueMixedGUIDS() {
    let query = `match ()-[a]->(), (b) where a.M_GUID = b.M_GUID return distinct a.M_GUID`;
    const session = this.driver.session();

    session
      .run(query)
      .subscribe({
        onNext: function(record) {
          let fixText = "";
          if (this.update) {
            fixText = "; this cannot be automatically fixed."
          }
          console.log(`Warning: GUID ${record._fields[0]} is attached to at least one node AND at least one relation${fixText}`);
        },
        onCompleted: function() {
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

//-----------------------------------------------------------------------------
  verifyWidgetNodes() {
    if (this.changeCount === null) {
      setTimeout(this.tryAgain, 100, this, "verifyWidgetNodes");
      return;
    }

    console.log("Checking for existence of widget nodes...");
    const widgets = ["dataBrowser", "trashTable", "widgetTableNodes", "widgetNode", "widgetTableQuery", "widgetCalendar", "widgetSVG"]; // top-level widgets only, for now
    const query = `match (n:M_Widget) return n`;
    const session = this.driver.session();
    const integrity = this;
    let result = [];

    session
      .run(query)
      .subscribe({
        onNext: function(record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }

          result.push(obj.n.properties.name); // Should add the name to the result array
        },
        onCompleted: function() {
          const needed = widgets.filter(x => result.indexOf(x) < 0); // Keep the names that AREN'T already in the DB
          if (needed.length > 0) {
            let fixText = "";
            if (integrity.update) {
              fixText = "; adding now";
              integrity.addWidgetNodes(needed);
            }
            console.log(`The following widget types do not have nodes: ${needed}${fixText}`);
          }
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
  }

  addWidgetNodes(needed) {
    const next = needed.pop();
    const GUID = this.uuid();
    const query = `Create (n:M_Widget {name:"${next}", help:"To be added by user", M_GUID:'${GUID}'}),
    (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
      item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
      action:'create', label:"M_Widget"}),
    (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
      item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
      action:'change', attribute:'name', value:'${next}'}),
    (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
      item_GUID:"${GUID}", user_GUID:'integrity', M_GUID:'${this.uuid()}',
      action:'change', attribute:'help', value:"To be added by user"})`;

    const session = this.driver.session();
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onCompleted: function() {
          if (needed.length > 0) {
            integrity.addWidgetNodes(needed);
          }
          session.close();
        },
        onError: function(error) {
          console.log(error);
        }
      });
    }
}
