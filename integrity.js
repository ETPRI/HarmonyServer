module.exports = class integrity {
  /* NOTE: Integrity tests to add later:
  Make sure no item has more than one owner
  Make sure no two items have the same GUID
  Verify that metadata exists? (drawback is I'd have to duplicate code from metadata class)
  */

  constructor(driver, uuid) {
    this.uuid = uuid;
    this.driver = driver;
    this.update = false; // Flag determining whether to FIX problems or just ALERT the user to them. Defaults to false (just alert).
    this.changeCount = 0;
    this.getChangeCount();
  }

  all() {
    this.missingNodeGUIDS();
    this.missingRelGUIDS();
    // this.findLinks();
    this.checkMetaDataFields();
    this.verifyCalendars();
    this.verifyLoginTables();
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

  //---------------------------------------------------------------------------

  missingNodeGUIDS() {
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

/*-----------------------------------------------------------------------------

  findLinks() {
    console.log ("Checking for missing/outdated directLink relations...");
    let query = `match (sub)<-[:Subject]-(view:M_View)-[:Link]->(obj) return sub, view, obj`;

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
        },
        onCompleted: function () {
          if (result.length > 0) {
            integrity.findNextLink(result);
          }
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  // Data should be an array of objects, each representing one link and containing sub, view and obj objects
  // For each row, search for a directLink from the subject to the object with the appropriate direction.
  // If not found, create it with tempCount = 1. If found, and it has no tempCount, set tempCount = 1.
  // If found, and it has a tempCount, increment the tempCount.
  findNextLink(data) {
    if (data.length > 0) { // Keep calling itself recursively while there's more data
      const line = data.pop();
      const query = `match (sub), (obj) where ID(sub) = ${line.sub.identity.low} and ID(obj) = ${line.obj.identity.low}
                   merge (sub)-[d:directLink {direction:'${line.view.properties.direction}'}]->(obj)
                   on create set d.tempCount = 1, d.newlyCreated = "true", d.M_GUID = "${this.uuid()}"
                   on match set d.tempCount = coalesce(d.tempCount+1, 1)`;

      const session = this.driver.session();
      const integrity = this;

      session
        .run(query)
        .subscribe({
          onCompleted: function () {
            integrity.findNextLink(data);
            session.close();
          },
          onError: function (error) {
            console.log(error);
          }
        });
    } // end if (there's more data)
    else { // when there are no more data to process
      this.deleteLinks();
    }
  }

  // find links which existed, but didn't need to (there were no View links associated with them). If updating, delete them.
  deleteLinks() {
    let del = "";
    if (this.update) {
      del = `delete d create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                                   item_GUID:d.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                                   action:'delete'})`;
    }

    let deleting = "";
    if (this.update) {
      deleting = "; deleting...";
    }

    let query = `match (sub)-[d:directLink]->(obj) where not exists(d.tempCount) ${del} return sub, obj`;

    const session = this.driver.session();
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          console.log(`Found unneeded direct link from ${obj.sub.properties.name}:${obj.sub.labels[0]} to ${obj.obj.properties.name}:${obj.obj.labels[0]}${deleting}`);
        },
        onCompleted: function () {
          integrity.addLinks();
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  // find links which didn't exist, but should have (there are View links between the nodes).
  // If updating, make them permanent; otherwise, delete them in order not to change the DB.
  addLinks() {
    let change = "delete d"; // If we aren't actually changing the DB, then delete the newly-created directLink
    if (this.update) {
      // If we DO want to change the DB, then update the new directLink's count and stop marking it as new. Also, create changeLogs.
      change = `set d.count = d.tempCount remove d.newlyCreated
                create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                          item_GUID:d.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                          action:'create', label:'directLink'}),
                        (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                          item_GUID:d.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                          action:'change', attribute:'direction', value:d.direction}),
                        (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                          item_GUID:d.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                          action:'change', attribute:'count', value:d.count})`;
    }
    let query = `match (sub)-[d:directLink]->(obj) where d.newlyCreated = "true" ${change} return sub, obj`; // Links that weren't IN the DB before we started

    const session = this.driver.session();
    const integrity = this;

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }

          let changing = "";
          if (integrity.update) {
            changing = "; adding..."
          }

          console.log(`Found missing direct link from ${obj.sub.properties.name}:${obj.sub.labels[0]} to ${obj.obj.properties.name}:${obj.obj.labels[0]}${changing}`);
        },
        onCompleted: function () {
          integrity.addCount();
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  // find links which already existed, but had no counts. If updating, set their counts.
  addCount() {
    let change = "";
    if (this.update) {
      change = `set d.count = d.tempCount
      create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                item_GUID:d.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                action:'change', attribute:'count', value:d.count})`;
    }
    let query = `match (sub)-[d:directLink]->(obj) where exists(d.tempCount) and not exists(d.count)
                 and (not exists(d.newlyCreated) or d.newlyCreated <> "true") ${change} return sub, obj, d.tempCount as count`

    const session = this.driver.session();
    const integrity = this;

    session
     .run(query)
     .subscribe({
       onNext: function (record) {
         const obj={};
         for (let i=0; i< record.length; i++) {
           obj[record.keys[i]]=record._fields[i];
         }

         let changing = "";
         if (integrity.update) {
           changing = `; setting count to ${obj.count.low}...`;
         }

         console.log(`Direct link from ${obj.sub.properties.name}:${obj.sub.labels[0]} to ${obj.obj.properties.name}:${obj.obj.labels[0]} is missing "count" field${changing}`);
       },
       onCompleted: function () {
         integrity.updateCount();
         session.close();
       },
       onError: function (error) {
         console.log(error);
       }
     });
  }

  // find links which existed and had counts, but the counts were inaccurate. If updating, correct the counts.
  updateCount() {
    let change = "";
    if (this.update) {
      change = `set d.count = d.tempCount
                create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                          item_GUID:d.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
                          action:'change', attribute:'count', value:d.count})`;
    }
    let query = `match (sub)-[d:directLink]->(obj) where exists(d.count) and exists(d.tempCount) and d.count <> d.tempCount
                 with sub, obj, d, d.count as old ${change} return sub, obj, old, d.tempCount as temp`;

    const session = this.driver.session();
    const integrity = this;

    session
     .run(query)
     .subscribe({
       onNext: function (record) {
         const obj={};
         for (let i=0; i< record.length; i++) {
           obj[record.keys[i]]=record._fields[i];
         }

         let changing = "";
         if (integrity.update) {
           changing = `; updating count...`;
         }

         console.log(`Direct link from ${obj.sub.properties.name}:${obj.sub.labels[0]} to ${obj.obj.properties.name}:${obj.obj.labels[0]} has incorrect count (should be ${obj.temp.low}, is ${obj.old.low})${changing}`);
       },
       onCompleted: function () {
         integrity.deleteTempCount();
         session.close();
       },
       onError: function (error) {
         console.log(error);
       }
     });
  }

  // remove tempCount variable from all directLinks
  deleteTempCount() {
    let query = "match ()-[d:directLink]->() where exists(d.tempCount) remove d.tempCount";

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

-----------------------------------------------------------------------------*/

  checkMetaDataFields() {
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

    let query = `MATCH (m:M_MetaData {name:"${node}"}) set m.fields = "${stringEscape(JSON.stringify(fields))}"
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
    let query = `match (a:tempAdmin {name:"Temporary Admin Account"}) detach delete a
                 create (change${this.changeCount++}:M_ChangeLog {number:${this.changeCount},
                  item_GUID:a.M_GUID, user_GUID:'integrity', M_GUID:'${this.uuid()}',
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
}
