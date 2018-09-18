module.exports = class integrity {
  constructor(driver, uuid) {
    this.uuid = uuid;
    this.driver = driver;
    this.update = false; // Flag determining whether to FIX problems or just ALERT the user to them. Defaults to false (just alert).
  }

  all() {
    this.missingNodeGUIDS();
    this.missingRelGUIDS();
    this.findLinks();
  }

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
          console.log(`Found node with missing GUID. Type: ${obj.labels[0]}. Name (if applicable): ${obj.properties.name}`);
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

    for (let i = 0; i < data.length; i++) {
      nodes += `(n${i}), `;
      where += `ID(n${i}) = ${data[i].n.identity.low} and `;
      set += `n${i}.M_GUID = '${this.uuid()}', `;
    }

    nodes = nodes.slice(0, nodes.length - 2);
    where = where.slice(0, where.length - 5);
    set = set.slice (0, set.length - 2);

    const query = `${nodes} ${where} ${set}`;

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

    for (let i = 0; i < data.length; i++) {
      rels += `()-[r${i}]->(), `;
      where += `ID(r${i}) = ${data[i].r.identity.low} and `;
      set += `r${i}.M_GUID = '${this.uuid()}', `;
    }

    rels = rels.slice(0, rels.length - 2);
    where = where.slice(0, where.length - 5);
    set = set.slice (0, set.length - 2);

    const query = `${rels} ${where} ${set}`;

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
      del = "delete d";
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
          let deleting = "";
          if (integrity.update) {
            deleting = "; deleting...";
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
      change = "set d.count = d.tempCount remove d.newlyCreated"; // If we DO want to change the DB, then update the new directLink's count and stop marking it as new
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
      change = "set d.count = d.tempCount";
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
      change = "set d.count = d.tempCount";
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
}
