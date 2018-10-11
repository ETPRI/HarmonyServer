module.exports = class CRUD {
  constructor(uuid, integrity, driver) {
    this.uuid = uuid;
    this.integrity = integrity;
    this.driver = driver;
  }

  runCRUD(obj, response) {
    if (obj.function in this) {
      this[obj.function](obj, response);
    }
    else {
      console.log(`Error: ${obj.function} is not a CRUD function.`);
    }
  }

  createNode(obj, response) {
    let dataObj = obj.query;
    const uuid = this.uuid();

    const createChangeNumber = ++this.integrity.changeCount;

    const strings = {ret:"", where:""}; // where won't be used here, but I'm including it for consistency
    const changeLogData = {"userGUID":obj.GUID, "itemGUID":uuid, "changeLogs":""}
    const node = this.buildSearchString(dataObj, strings, "where", "node", changeLogData);

    if (strings.ret !== "") {
      strings.ret = `return ${strings.ret}`;
    }

    let changeLogs = `(change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:'${uuid}', user_GUID:'${obj.GUID}',
                       action:'create', label:'${dataObj.type}', M_GUID:'${this.uuid()}'}), ${changeLogData.changeLogs}`;
    changeLogs = changeLogs.slice(0,changeLogs.length-2); // remove the last ", "

    const query = `create (${node}), ${changeLogs} set node.M_GUID = '${uuid}' ${strings.ret}`;

    console.log(query);
    this.sendQuery(query, response);
  }

  deleteNode(obj, response) {
    let dataObj = obj.query;

    const strings = {ret:"", where:""};
    const node = this.buildSearchString(dataObj, strings, "where", "node");

    const query = `match (${node}) with node, node.M_GUID as id detach delete node
                   create (c:M_ChangeLog {number:${++this.integrity.changeCount}, action:'delete', item_GUID:id, user_GUID:'${obj.GUID}', M_GUID:'${this.uuid()}'})`;
    this.sendQuery(query, response);
  }

  changeNode(obj, response) {
    let dataObj = obj.query;
    const strings = {ret:"", where:""};
    // Build the string representing the node - what goes in the parentheses
    const node = this.buildSearchString(dataObj.node, strings, "where", "node");

    // Build the string representing the changes - what comes after the SET keyword
    // dataObj.changes should be an array, each entry in which includes a property, a value and possibly a string boolean
    let changes ="";
    let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
    if (dataObj.changes) {
      changes = this.buildChangesString(dataObj.changes, changeLogData);
    }

    let changeLogs = "";
    if (changeLogData.changeLogs.length > 0) {
      changeLogs = `with node create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
    }

    if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    let orderBy = "";
    if (dataObj.order) {
      orderBy = this.buildOrderString(dataObj.order, "node");
    }

    if (dataObj.node.merge === true) {
      const session = this.driver.session();
      let result = [];
      const CRUD = this;

      const query = `match (${node}) ${strings.where} return node`; // search for the node and return it; make no changes
      session
        .run(query)
        .subscribe({
          onNext: function (record) {
            const obj={};
            for (let i=0; i< record.length; i++) {
              obj[record.keys[i]]=record._fields[i];
            }
            result.push(obj);
            console.log("%s/n",JSON.stringify(obj));
          },
          onCompleted: function () {
            if (result.length > 0) { // if the node was found, make any changes and return it
              const query2 = `match (${node}) ${strings.where} ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
              CRUD.sendQuery(query2, response);
              session.close();
            }

            // if the node was not found, move any changes into the node.properties object and pass the node object it to createNode.
            else {
              if (!(dataObj.node.properties)) {
                dataObj.node.properties = {};
              }

              // the changes array in this case will include "property" and "value"
              if (obj.changes) {
                for (let i = 0; i < obj.changes.length; i++) {
                  dataObj.node.properties[obj.changes[i].property] = obj.changes[i].value;
                }
              }

              const query2 = {"query":dataObj.node, "GUID":obj.GUID};
              CRUD.createNode(query2, response);
              session.close();
            }
          },
          onError: function (error) {
            console.log(error);
          }
        });
    } // end if (merging)

    else {
      const query = `match (${node}) ${strings.where} ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
      this.sendQuery(query, response);
    }
  }

  createRelation(obj, response) {
    let dataObj = obj.query;
    const strings = {ret:"", where:""};

    const createChangeNumber = ++this.integrity.changeCount;

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where", "from");
    }
    else {
      from = this.buildSearchString({}, strings, "where", "from");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where", "to");
    }
    else {
      to = this.buildSearchString({}, strings, "where", "to");
    }

    // Build the string representing the relation - what goes in the brackets. This gets created, not found,
    // so include changeLog data to record setting each attribute.
    let uuid = this.uuid();
    const changeLogData = {"userGUID":obj.GUID, "itemGUID":uuid, "changeLogs":""}

    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where", "rel", changeLogData);
    }
    else {
      rel = this.buildSearchString({}, strings, "where", "rel"); // if there's no rel object, there are no attributes to set - no need for changeLogData
    }

    // finish the string to generate changeLogs
    const changeUUID = this.uuid();
    let changeLogs = `(change0:M_ChangeLog {number:${createChangeNumber}, item_GUID:'${uuid}', user_GUID:'${obj.GUID}',
                       to_GUID:to.M_GUID, from_GUID:from.M_GUID, label:'${dataObj.rel.type}',
                       action:'create', M_GUID:'${changeUUID}'}), ${changeLogData.changeLogs}`;
    changeLogs = changeLogs.slice(0,changeLogs.length-2); // remove the last ", "

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${from}), (${to}) ${strings.where}
                   create (from)-[${rel}]->(to), ${changeLogs} set rel.M_GUID = '${uuid}' ${strings.ret}`;
    this.sendQuery(query, response);
  }

  deleteRelation(obj, response) {
    let dataObj = obj.query;
    // These strings are stored in an object so they can be passed in and out of methods and updated
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where", "from");
    }
    else {
      from = this.buildSearchString({}, strings, "where", "from");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where", "to");
    }
    else {
      to = this.buildSearchString({}, strings, "where", "to");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "where", "rel");
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${from})-[${rel}]->(${to}) ${strings.where} with to, from, rel, rel.M_GUID as id
                   delete rel create (c:M_ChangeLog {number:${++this.integrity.changeCount}, action:'delete', item_GUID:id, user_GUID:'${obj.GUID}', M_GUID:'${this.uuid()}'})
                   ${strings.ret}`;
    this.sendQuery(query, response);
  }

  changeRelation(obj, response) {
    let dataObj = obj.query;
    // These strings are stored in an object so they can be passed in and out of methods and updated
    const strings = {ret:"", nodesWhere:"", relWhere:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "nodesWhere", "from");
    }
    else {
      from = this.buildSearchString({}, strings, "nodesWhere", "from");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "nodesWhere", "to");
    }
    else {
      to = this.buildSearchString({}, strings, "nodesWhere", "to");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "relWhere", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "relWhere", "rel");
    }

    // Build the string representing the changes - what comes after the SET keyword
    // dataObj.changes should be an array, each entry in which includes an item, a property, a value and possibly a string boolean
    let changes ="";
    let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
    if (dataObj.changes) {
      changes = this.buildChangesString(dataObj.changes, changeLogData);
    }

    let changeLogs = "";
    if (changeLogData.changeLogs.length > 0) {
      changeLogs = `with from, rel, to create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    let orderBy = "";
    if (dataObj.order) {
      orderBy = this.buildOrderString(dataObj.order);
    }

    // Simulate merging without using the MERGE keyword
    if (dataObj.rel.merge === true) {
      const session = this.driver.session();
      let result = [];
      const CRUD = this;

      // start by trying to match the whole pattern, as if not merging, but don't make any changes yet
      const query = `match (${from}), (${to}) ${strings.nodesWhere}
                     match (from)-[${rel}]->(to) ${strings.relWhere}
                     return rel`;

      session
        .run(query)
        .subscribe({
          onNext: function (record) {
            const obj={};
            for (let i=0; i< record.length; i++) {
              obj[record.keys[i]]=record._fields[i];
            }
            result.push(obj);
            console.log("%s/n",JSON.stringify(obj));
          },
          onCompleted: function () {
            // if the pattern was found, remove the merge flag (since no creation is needed) and call changeRelation again
            if (result.length > 0) {
              dataObj.rel.merge = false;
              CRUD.changeRelation(obj,response); // obj contains dataObj and should be updated as dataObj changes
            }
            else { // if the pattern was not found, look for the nodes. Passing in the search strings will make it easier.
              CRUD.findNodesForMerge(from, to, strings.nodesWhere, obj, response);
            }
          },
          onError: function (error) {
            console.log(error);
          }
        });
    } // end if (merging)

    else {
      const query = `match (${from}), (${to}) ${strings.nodesWhere} match (from)-[${rel}]->(to) ${strings.relWhere} ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
      this.sendQuery(query, response);
    }
  }

  findOptionalRelation(obj, response) {
    let dataObj = obj.query;
    // These strings are stored in an object so they can be passed in and out of methods and updated
    // Need TWO where clauses - one for the required node, one for the optional node and relation
    const strings = {ret:"", reqWhere:"", optWhere:""};

    // Build the string representing the "required" node - what goes in the first set of parentheses
    let required = "";
    if (dataObj.required) {
      required = this.buildSearchString(dataObj.required, strings, "reqWhere", "required");
    }
    else {
      required = this.buildSearchString({}, strings, "reqWhere", "required");
    }

    // Build the string representing the "optional" node - what goes in the second set of parentheses
    let optional = "";
    if (dataObj.optional) {
      optional = this.buildSearchString(dataObj.optional, strings, "optWhere", "optional");
    }
    else {
      optional = this.buildSearchString({}, strings, "optWhere", "optional");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "optWhere", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "optWhere", "rel");
    }

    // Build the string representing the changes - what comes after the SET keyword
    // dataObj.changes should be an array, each entry in which includes an item, a property, a value and possibly a string boolean
    let changes ="";
    let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
    if (dataObj.changes) {
      changes = this.buildChangesString(dataObj.changes, changeLogData);
    }

    let changeLogs = "";
    if (changeLogData.changeLogs.length > 0) {
      changeLogs = `with required, rel, optional create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
    }

    // default is that the relation starts on the required node, but if the direction is specified, it can go backward
    let arrow = `-[${rel}]->`;
    if (dataObj.rel && dataObj.rel.direction && dataObj.rel.direction == "left") {
      arrow = `<-[${rel}]-`;
    }

    let orderBy = "";
    if (dataObj.order) {
      orderBy = this.buildOrderString(dataObj.order);
    }

    if (strings.ret.length > 0) {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${required}) ${strings.reqWhere}
                   optional match (required)${arrow}(${optional}) ${strings.optWhere}
                   ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
    this.sendQuery(query, response);
  }

  changeTwoRelPattern(obj, response) {
    let dataObj = obj.query;
    const strings = {ret:"", where:""};

    // Build the string representing the "start" node - what goes in the first set of parentheses
    let start = "";
    if (dataObj.start) {
      start = this.buildSearchString(dataObj.start, strings, "where", "start");
    }
    else {
      start = this.buildSearchString({}, strings, "where", "start");
    }

    // Build the string representing the "middle" node - what goes in the second set of parentheses
    let middle = "";
    if (dataObj.middle) {
      middle = this.buildSearchString(dataObj.middle, strings, "where", "middle");
    }
    else {
      middle = this.buildSearchString({}, strings, "where", "middle");
    }

    // Build the string representing the "end" node - what goes in the third set of parentheses
    let end = "";
    if (dataObj.end) {
      end = this.buildSearchString(dataObj.end, strings, "where", "end");
    }
    else {
      end = this.buildSearchString({}, strings, "where", "end");
    }

    // Build the string representing the first relation - what goes in the first set of brackets
    let rel1 = "";
    if (dataObj.rel1) {
      rel1 = this.buildSearchString(dataObj.rel1, strings, "where", "rel1");
    }
    else {
      rel1 = this.buildSearchString({}, strings, "where", "rel1");
    }

    // Build the string representing the second relation - what goes in the second set of brackets
    let rel2 = "";
    if (dataObj.rel2) {
      rel2 = this.buildSearchString(dataObj.rel2, strings, "where", "rel2");
    }
    else {
      rel2 = this.buildSearchString({}, strings, "where", "rel2");
    }


    // Build the string representing the changes - what comes after the SET keyword
    // dataObj.changes should be an array, each entry in which includes an item, a property, a value and possibly a string boolean
    let changes ="";
    let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
    if (dataObj.changes) {
      changes = this.buildChangesString(dataObj.changes, changeLogData);
    }

    let changeLogs = "";
    if (changeLogData.changeLogs.length > 0) {
      changeLogs = `with start, middle, end, rel1, rel2 create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    let orderBy = "";
    if (dataObj.order) {
      orderBy = this.buildOrderString(dataObj.order);
    }

    const query = `match (${start})-[${rel1}]->(${middle})-[${rel2}]->(${end}) ${strings.where}
                   ${changes} ${changeLogs} ${strings.ret} ${orderBy}`;
    this.sendQuery(query, response);
  }

  tableNodeSearch(obj, response) {
    let dataObj = obj.query;
    let GUID = obj.GUID;

    // Example search string:
    // match (n:type) where n.numField < value and n.stringField =~(?i)value
    // optional match (n)-[:Permissions]->(perm:M_LoginTable) return n, perm.name as permissions
    // order by first, second desc, third limit 9

    // Notes: use *. for wildcard in string search. Only search for permissions if type = people.
    // Regexes apparently have to be in a where clause, not in curly braces, so for simplicity, put all criteria in where clause.

    // Build the where clause, starting with requirement that current user has not trashed this node
    let where = `where a.M_GUID='${GUID}' and not (a)-[:Trash]->(${dataObj.name}) and `;

    for (let field in dataObj.where) {
      if (dataObj.where[field].fieldType == "string") {
        // =~: regex; (?i): case insensitive; #s# and #E#: placeholders for start and end variables
        // (start and end variables can be ".*", meaning "any string", or "", meaning "nothing")
        const w = `${dataObj.name}.${field}=~"(?i)#s#${dataObj.where[field].value}#E#" and `;
        let w1="";
        switch(dataObj.where[field].searchType) {
          case "S":    // start
            // Anything can come AFTER the specified value, but nothing BEFORE it (it starts the desired string)
            w1 = w.replace('#s#',"").replace('#E#','.*');    break;
          case "M":    // middle
            // Anything can come before or after the specified value (as long as it appears anywhere in the string)
            w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
          case "E":    // end
            // Anything can come BEFORE the specified value, but nothing AFTER it (it ends the desired string)
            w1 = w.replace('#s#',".*").replace('#E#','');    break;
          case "=":    // equal to
            // NOTHING can come before OR after the specified value (string must match it exactly)
            w1 = w.replace('#s#',"").replace('#E#','');      break;
          default:
            console.log("Error: search type for a string field is not 'S', 'M', 'E' or '='.");
        }
        where += w1;
      }
      else { // number field
        where += `${dataObj.name}.${field} ${dataObj.where[field].searchType} ${dataObj.where[field].value} and `;
      }
    }

    if (dataObj.owner) {
      const w = `o.name=~"(?i)#s#${dataObj.owner.value}#E#" and `;
      let w1="";
      switch(dataObj.owner.searchType) {
        case "S":    // start
          // Anything can come AFTER the specified value, but nothing BEFORE it (it starts the desired string)
          w1 = w.replace('#s#',"").replace('#E#','.*');    break;
        case "M":    // middle
          // Anything can come before or after the specified value (as long as it appears anywhere in the string)
          w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
        case "E":    // end
          // Anything can come BEFORE the specified value, but nothing AFTER it (it ends the desired string)
          w1 = w.replace('#s#',".*").replace('#E#','');    break;
        case "=":    // equal to
          // NOTHING can come before OR after the specified value (string must match it exactly)
          w1 = w.replace('#s#',"").replace('#E#','');      break;
        default:
          console.log("Error: search type for a string field is not 'S', 'M', 'E' or '='.");
      }
      where += w1;
    }

    if (dataObj.permissions) {
      switch (dataObj.permissions) {
        case "users":
          where += `t.name = 'User' and `;
          break;
        case "admins":
          where += `t.name = 'Admin' and `;
          break;
        case "allUsers": // These do nothing - they're only here so that a REAL default can produce an error message
        case "all":
          break;
        default:
          console.log("Error: Search type for permissions is not users, admins, users and admins, or all people");
      }
    }

    // Remove the last " and " from the where clause
    where = where.slice(0, -5);

    let withClause = `with ${dataObj.name}`;
    let ret = `return distinct ${dataObj.name}`;

    let permCheck = "";
    if (dataObj.type == "people") {
      permCheck = `optional match (${dataObj.name})-[:Permissions]->(perm:M_LoginTable)`;
      ret += `, perm.name as permissions`;
      withClause += `, perm`;
    }

    let ownerCheck = "";
    if (dataObj.type == "mindmap") {
      ownerCheck = `optional match (${dataObj.name})-[:Owner]->(owner:people)`;
      ret += `, owner.name as owner`;
      withClause += `, owner`;
    }

    let match = `match (${dataObj.name}:${dataObj.type})`;

    // NOTE: These next two won't work together - if I ever hit a situation where a person can have an owner, I'll have to rewrite.
    if (dataObj.owner) {
      match += `-[:Owner]->(o:people)`;
    }

    if (dataObj.permissions && dataObj.permissions != "all") {
      match += `-[:Permissions]->(t:M_LoginTable)`; // require a permissions link
    }

    let linkCheck = "";
    for (let i = 0; i < dataObj.links.length; i++) {
      match += `, (link${i} {M_GUID:'${dataObj.links[i]}'})`;
      linkCheck += `match (${dataObj.name})-[:directLink]-(link${i}) `;
      withClause += `, link${i}`;
    }

    let orderBy = this.buildOrderString(dataObj.orderBy, "n");

    const query = `${match}, (a) ${where} ${permCheck} ${ownerCheck} ${withClause} ${linkCheck}
                   ${ret} ${orderBy} limit ${dataObj.limit}`;
    this.sendQuery(query, response);
  }

  getMetaData(obj, response) {
    let queryName = obj.query;
    let GUID = obj.GUID;

    const metadataQueries = {
      nodes: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
      ,keysNode: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p) as label,  count(key) as count  order by key"
      ,relations: "MATCH (a)-[r]->(b) return distinct labels(a), type(r), labels(b), count(r) as count  order by type(r)"
      ,keysRelation: "match ()-[r]->() unwind keys(r) as key return distinct key, type(r), count(key) as count"
      ,myTrash: `match (user)-[rel:Trash]->(node) where user.M_GUID = '${GUID}' return node.name as name, node.M_GUID as GUID, labels(node) as labels, rel.reason as reason, node`
      ,allTrash: `match ()-[rel:Trash]->(node) return node.M_GUID as GUID, node.name as name, count(rel) as count`
    }

    this.sendQuery(metadataQueries[queryName], response);
  }

  // changeLogData includes: userGUID, itemGUID, changeLogs
  buildSearchString(obj, strings, whereString, defaultName, changeLogData) {
    let string = defaultName;

    if (obj.return !== false) { // This should usually be undefined if it's not false, but users might also set it to true
      if (strings.ret == "") {
        strings.ret = `${defaultName}`;
      }
      else strings.ret += `, ${defaultName}`;

      if (obj.name) {
        strings.ret += ` as ${obj.name}`;
      }
    }

    if (obj.type) {
      string += `:${obj.type}`;
    }

    if (obj.properties) { // If any properties were specified...
      let props = "";
      for (let prop in obj.properties) { // go through all of them...
        // add to the changeLog string if necessary...
        if (changeLogData) {
          changeLogData.changeLogs += `(change${this.integrity.changeCount++}:M_ChangeLog {number:${this.integrity.changeCount},
                                       item_GUID:'${changeLogData.itemGUID}', user_GUID:'${changeLogData.userGUID}',
                                       action:'change', attribute:'${prop}', value:'${obj.properties[prop]}', M_GUID:'${this.uuid()}'}), `;
        }
        if (props == "") { // and add each one to the props string.
          props = `${prop}: "${obj.properties[prop]}"`;
        }
        else props += `, ${prop}: "${obj.properties[prop]}"`;
      }
      string += `{${props}}`;
    }

    if (obj.id && whereString) {
      if (strings[whereString] == "") {
        strings[whereString] = `where ID(${defaultName}) = ${obj.id}`;
      }
      else strings[whereString] += ` and ID(${defaultName}) = ${obj.id}`;
    }

    return string;
  }

  // changeLogData includes: userGUID, changeLogs
  buildChangesString(changeArray, changeLogData) {
    let changes = "";
    let item = "node"; // default, for changeNode
    for (let i = 0; i < changeArray.length; i++) { // go through all changes...

      let value = `"${changeArray[i].value}"`; // set the value of the attribute...
      if (changeArray[i].string === false) { // default is that the new value is a string, but can be overridden
        value = `${changeArray[i].value}`;
      }
      if (changeArray[i].item) {
        item = changeArray[i].item;
      }

      // add to the changeLog string
      changeLogData.changeLogs += `(change${this.integrity.changeCount++}:M_ChangeLog {number:${this.integrity.changeCount},
                                   item_GUID:${item}.M_GUID, user_GUID:'${changeLogData.userGUID}', M_GUID:'${this.uuid()}',
                                   action:'change', attribute:'${changeArray[i].property}', value:'${value}'}), `;

      if (changes == "") {
        changes = `set ${item}.${changeArray[i].property} = ${value}`; // add to the string that implements changes
      }
      else changes += `,${item}.${changeArray[i].property} = ${value}`;
    }
    return changes;
  }

  // orderArray: Array of objects containing item (except for changeNode), name and direction ("A" or "D", but "A" is default and doesn't need to be specified)
  buildOrderString(orderArray, defaultName) {
    let order = "order by ";
    let item = defaultName; // name to use if no item is specified
    for (let i = 0; i < orderArray.length; i++) {
      let o = orderArray[i];
      if (o.item) {
        item = o.item;
      }
      let dir = "";
      if (o.direction == "D") {
        dir = " desc";
      }
      order += `${item}.${o.name}${dir}, `;
    }
    return order.slice(0, order.length-2); // Remove the last ", " and return
  }

  sendQuery(query, response) {
    const session = this.driver.session();
    let result = [];

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
        const obj={};
        for (let i=0; i< record.length; i++) {
          obj[record.keys[i]]=record._fields[i];
        }
        result.push(obj);
          console.log("%s/n",JSON.stringify(obj));
        },
        onCompleted: function () {
          // Results should be an array of row objects. Each row object will contain one object per item to return.
          // Each of THOSE may contain integer objects with a "high" and "low" value, which should be converted to a simple number.
          // Identity variables, specifically, should be rewritten as "id" for ease of typing later.
          // (NOTE: Consider removing the id variable entirely - it's unreliable in Neo4j and may be very different in other DBs.)
          // Also, row objects from metadata queries may include an id or count variable, which should also be rewritten.
          for (let i = 0; i < result.length; i++) { // For every row, start by simplifying the count and ID if they exist...
            const row = result[i];
            if (row.count) {
              row.count = row.count.low;
            }
            if (row.id) {
              row.id = row.id.low;
            }

            for (let item in row) { // for every item in the row, replace the identity if it exists
              const entry = row[item];
              if (entry && entry.identity && entry.identity.low) {
                const IDobj = entry.identity;
                const ID = IDobj.low;
                entry.id = ID;
                delete entry.identity;
              }

              if (entry && entry.properties) { // If the item has properties...
                for (let property in entry.properties) { // then for every property...
                  const value = entry.properties[property];
                  // This is the best set of criteria I can see to recognize an Integer object without using Neo4j functions:
                  // It has exactly two own properties (high and low), "high" is 0 and "low" is an integer.
                  // NOTE: I have since learned that very large integers can have a value in "high" as well.
                  // I don't see it coming up often, and if it does, we'll probably need to leave the Integer alone anyway.
                  if (typeof value === "object" && Object.keys(value).length == 2 // if the property is an Integer with no high value...
                      && "low" in value && Number.isInteger(value.low) && "high" in value && value.high === 0) {
                    entry.properties[property] = value.low; // simplify it.
                  } // end if (value is a Neo4j integer)
                } // end for (every property in the item)
              } // end if (the item has properties)
            } // end for (every item in the row)
          } // end for (every row)
          response.end(JSON.stringify(result));
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
    }

  findNodesForMerge(from, to, where, obj, response) {
    // search for the nodes that the relation should be merged between. Make any changes to the nodes. Return them (just to prove something was there).
    const dataObj = obj.query;
    const nodeChanges = [];

    if (dataObj.changes) { // If any changes were requested...
      if (!dataObj.rel.properties) {
        dataObj.rel.properties = {}; // make sure there is a properties object...
      }

      for (let i = 0; i < dataObj.changes.length; i++) {
        if (dataObj.changes[i].item === "rel") { // move relation changes into properties object...
          dataObj.rel.properties[dataObj.changes[i].property] = dataObj.changes[i].value;
        }
        else { // and get ready to make changes to the nodes.
          nodeChanges.push(dataObj.changes[i]);
        }
      }
    }

    // build the string to make changes and the strings to create changeLogs
    let changes ="";
    let changeLogData = {"userGUID":obj.GUID, changeLogs:""};
    if (nodeChanges.length > 0) {
     changes = this.buildChangesString(nodeChanges, changeLogData);
    }

    let changeLogs = "";
    if (changeLogData.changeLogs.length > 0) {
      changeLogs = `with from, to create ${changeLogData.changeLogs.slice(0, changeLogData.changeLogs.length - 2)}`;
    }

    const query = `match (${from}), (${to}) ${where} ${changes} ${changeLogs} return from, to`;

    const session = this.driver.session();
    let result = [];
    const CRUD = this;

    session
      .run(query)
      .subscribe({
        onNext: function (record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          result.push(obj);
          console.log("%s/n",JSON.stringify(obj));
        },
        onCompleted: function () {
          // If the start and end nodes were found, they have already had any changes applied - just call createRelation.
          if (result.length > 0) {
            CRUD.createRelation(obj, response);
            session.close();
          }
          else { // If the nodes don't exist, just return the empty array that was received from the node search
            response.end(JSON.stringify(result));
            session.close();
          }
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }
}
