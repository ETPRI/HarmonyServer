/*
Stores information about the types of nodes that are included in the database.
Eventually, we want to move this information to the database and enable the user to customize it.
The only thing I don't think we should let them do is delete the "person" type, because
if there are no people there can be no users or admins, so no one would be able to log in.
*/

class metaData {
//  calls initNodeData and initRelationData to build the node and relation objects.
constructor () {
  this.node     = {};  this.initNodeData();
  this.relation = {};  this.initRelationData();
}

// returns the object associated with the name that was passed in. This object describes a type of relation.
getRelation(name){
  return(this.relation[name]);
}

// returns the object associated with the name that was passed in. This object describes a type of node.
getNode(name){
  return(this.node[name]);
}

// Initializes the objects representing different types of relations. All objects are stored as key/value pairs in this.relation.
// The objects include a label for the type of link, and a list of fields which should be stored for this type of link with their labels.
initRelationData(){
  this.relation.Favorite = {
     relLabel: "Favorite"
    ,fields: {
      "M_GUID":{label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID"]
    ,orderBy: [{"name":"M_GUID"}]
  };

  this.relation.Owner = {
     relLabel: "Owner"
    ,fields: {
      "M_GUID":{label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID"]
    ,orderBy: [{"name":"M_GUID"}]
  };

  this.relation.User = {
     relLabel: "User"
    ,fields: {
      "M_GUID":{label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID"]
    ,orderBy: [{"name":"M_GUID"}]
  };

  this.relation.MapNode = {
     relLabel: "Map Node"
    ,fields: {
      "id": {label:"Label ID"}
      ,"M_GUID":{label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "id"]
    ,orderBy: [{"name":"id"}, {"name":"M_GUID"}]
  };

  this.relation.Trash = {
     relLabel: "Trash"
    ,fields: {
      "reason": {label:"Reason"}
      ,"M_GUID": {label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "reason"]
    ,orderBy: [{"name":"reason"}, {"name":"M_GUID"}]
  };

  this.relation.Permissions = {
     relLabel: "Permissions"
    ,fields: {
      "username": {label:"Username"}
      ,"password": {label:"Password"}
      ,"M_GUID": {label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "username", "password"]
    ,orderBy: [{"name":"username"}, {"name":"password"}, {"name":"M_GUID"}]
  };

  this.relation.ViewLink = {
     relLabel: "View Link"
    ,fields: {
      "userGUID": {label:"User GUID"}
      ,"comment": {label:"Comment"}
      ,"M_GUID": {label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "userGUID", "comment"]
    ,orderBy: [{"name":"userGUID"}, {"name":"comment"}, {"name":"M_GUID"}]
  };

  this.relation.View = {
     relLabel: "View"
    ,fields: {
      "start_order": {label:"Out order"}
      ,"end_order": {label:"In order"}
      ,"start_placeholders": {label:"Out comments"}
      ,"end_placeholders": {label:"In comments"}
      ,"M_GUID": {label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "start_order", "end_order", "start_placeholders", "end_placeholders"]
    ,orderBy: [{"name":"start_order"}, {"name":"end_order"}, {"name":"start_placeholders"}, {"name":"end_placeholders"}, {"name":"M_GUID"}]
  };

  this.relation.Settings = {
     relLabel: "Settings"
    ,fields: {
      "nodeLabel": {label:"Node Label"}
      ,"fields": {label:"Fields"}
      ,"fieldsDisplayed": {label:"Table Fields Displayed"}
      ,"formFieldsDisplayed": {label:"Form Fields Displayed"}
      ,"orderBy": {label:"Order By"}
      ,"M_GUID": {label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "nodeLabel", "fields", "fieldsDisplayed", "formFieldsDisplayed", "orderBy"]
    ,orderBy: [{"name":"nodeLabel"}, {"name":"fields"}, {"name":"fieldsDisplayed"}, {"name":"formFieldsDisplayed"}, {"name":"orderBy"}, {"name":"M_GUID"}]
  };

  this.relation.Request = {
     relLabel: "Request"
    ,fields: {
      "count": {label:"Request number"}
      ,"description": {label:"Description"}
      ,"startTime": {label:"Start Time (ms since 1970)"}
      ,"requestLength": {label:"Request Length (chars)"}
      ,"duration": {label:"Duration (ms)"}
      ,"responseLength": {label:"Response Length (chars)"}
      ,"endResult": {label:"End Result"}
      ,"M_GUID": {label:"GUID"}
    }
    ,fieldsDisplayed: ["M_GUID", "startTime", "count", "description","requestLength", "duration", "responseLength", "endResult"]
    ,orderBy: [
      {"name":"startTime"}
      ,{"name":"count"}
      ,{"name":"description"}
      ,{"name":"endResult"}
      ,{"name":"duration"}
      ,{"name":"requestLength"}
      ,{"name":"responseLength"}
      ,{"name":"M_GUID"}]
  };
}  /////// end method

// Initializes the objects representing various types of nodes. All objects are stored as key/value pairs in this.node.
// The objects include a label for the type of node, an ordering for which fields to sort nodes by first, a list of
// fields to display in widgetTableNodes, and a list of ALL fields, including ones only shown in a widgetNode widget,
// along with labels to refer to them by. Some fields also have an "att": an attribute to add to that field in the table.
initNodeData() { // move to DB in the future
  ///////////////////////////////////// ETPRI
  this.node.people = {
     nodeLabel: "People"
    ,orderBy: [{"name":"name"}, {"name":"nameLast"}, {"name":"nameFirst"},
               {"name":"email"}, {"name":"state"}, {"name":"comment"}]
    ,fieldsDisplayed: ["name","nameLast", "nameFirst", "email"]
    ,formFieldsDisplayed: ["name", "nameLast", "nameFirst", "email", "state", "comment"]
    ,fields: {
      // I'm not sure this att is needed. It refers to a method that doesn't exist and that I don't think we plan to implement.
     "name":       {label: "Name"      } // , att: `onclick="app.widget('relationAdd',this)"`
    ,"nameLast":   {label: "Last Name" }
    ,"nameFirst":  {label: "First Name"}
    ,"email":      {label: "Email"     }
    ,"state":      {label: "State"     }
    ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
    ,proposedFields:{}
  }

  this.node.organization = {
     nodeLabel: "organization"
    ,orderBy: [{"name":"name"}, {"name":"web"}, {"name":"comment"}]
    ,fieldsDisplayed: ["name", "web"]
    ,formFieldsDisplayed: ["name", "web"]
    ,fields: {"name":       {label: "Name" }
      ,"web":      {label: "Web"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
    ,proposedFields:{}
  }

  this.node.topic = {
     nodeLabel: "topic"
    ,orderBy: [{"name":"name"}, {"name":"comment"}]
    ,fieldsDisplayed: ["name", "comment"]
    ,formFieldsDisplayed: ["name", "comment"]
    ,fields: {"name":       {label: "Name", input:{name:"input"} }
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
    ,proposedFields:{}
  }

  this.node.address = {
    nodeLabel: "address"
    ,orderBy: [{"name":"name"}, {"name":"state"}, {"name":"postalCode"}, {"name":"city"}, {"name":"street1"}, {"name":"street2"}]
    ,fieldsDisplayed: ["name", "street1", "street2", "city", "state", "postalCode"]
    ,formFieldsDisplayed: ["name", "street1", "street2", "city", "state", "postalCode", "country", "comment"]
    ,fields: {"name":       {label: "Name"}
    ,"street1":    {label: "Street"}
    ,"street2":    {label: ""  }
    ,"city":       {label: "City"  }
    ,"state":      {label: "State"  }
    ,"postalCode": {label: "Zip"  }
    ,"country":    {label: "Country"  }
    ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
    ,proposedFields:{}
  }

  this.node.mindmap = {
    nodeLabel: "mindmap"
    ,orderBy: [{"name":"name"}, {"name":"comment"}] // ,lastEdited, created, lastEditor, creator
    ,fieldsDisplayed: ["name", "comment"] // , "creator", "created", "lastEditor", "lastEdited"
    ,formFieldsDisplayed: ["name", "comment"] // , "creator", "created", "lastEditor", "lastEdited"
    ,fields: {
      "name":         {label: "Name"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
      // ,"creator":     {label: "Created by"}  // Add this stuff later - have to research how to search by a date
      // ,"created":     {label: "Created on", type: "date"}
      // ,"lastEditor":  {label: "Last edited by"}
      // ,"lastEdited":  {label: "Last edited on", type: "date"}
    }
    ,proposedFields:{}
  }

  this.node.calendar = {
    nodeLabel: "calendar"
    ,orderBy: [{"name":"name"}, {"name":"description"}]
    ,fieldsDisplayed: ["name", "description"]
    ,formFieldsDisplayed: ["name", "description"]
    ,fields: {
      "name": {label: "Name"}
      ,"description": {label: "Description"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
      // Add more here later - probably search criteria (each calendar is like a different search for events)
    }
    ,proposedFields:{}
  }

  this.node.calendarEvent = {
     nodeLabel: "calendarEvent"
     ,orderBy: [{"name":"year"}, {"name":"month"}, {"name":"day"}, {"name":"hour"}, {"name":"minute"},]
     ,fieldsDisplayed: ["name", "description"]
     ,formFieldsDisplayed: ["name", "description"]
     ,fields: {
       "name": {label: "Name"}    // name of event
       ,"comment":    {label: "Comment", input: {name:"textarea"}}
       ,"year": {label: "Year"}    // YYYY
       ,"month": {label: "Month"}  // integer 1-12
       ,"day": {label: "Day"}      // 1 to 28-31 depending on the month
       ,"hour": {label: "Hour"}  // military time
       ,"minute": {label: "Minute"}
       ,"duration": {label: "Duration"}  // in minutes
       // Add more here later - probably search criteria (each calendar is like a different search for events)
     }
     ,proposedFields:{}
   }

  this.node.file = {
    nodeLabel: "file"
    ,orderBy: [{"name":"name"}, {"name":"type"}, {"name":"comment"}]
    ,fieldsDisplayed: ["name", "type", "comment"]
    ,formFieldsDisplayed: ["name", "type", "comment"]
    ,fields: {
      "name": {label: "Name"}
      ,"type": {label: "Type", editable:false, type:"array"}
      ,"comment": {label: "Comment", input:{name:"textarea"}}
    }
  }

  this.node.all = {
    nodeLabel:"All Nodes"
    ,orderBy: [{"name":"name"}, {"name":"comment"}]
    ,fieldsDisplayed:["type", "name", "comment"]
    ,fields: {
      "type": {label:"Type"}
      ,"name": {label:"Name"}
      ,"comment": {label:"Comment", input:{name:"textarea"}}
    }
  }

  this.node.M_LoginTable = {
    nodeLabel: "M_Login Table"
    ,orderBy: [{"name":"name"}]
    ,fieldsDisplayed: ["name"]
    ,formFieldsDisplayed: ["name"]
    ,fields: {
      "name": {label:"name"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
  }

  this.node.M_ChangeLog = {
    nodeLabel: "M_ChangeLog"
    ,orderBy: [{"name":"number", "direction": "D"}] // Descending. Shouldn't need anything else - numbers should be unique
    ,fieldsDisplayed: ["number", "action", "label", "attribute", "value"]
    ,formFieldsDisplayed: ["number", "action", "label", "attribute", "value", "from_GUID", "to_GUID", "item_GUID", "user_GUID"]
    ,fields: {
      "number": {label:"number"}
      ,"action": {label:"action"}
      ,"label": {label:"label"}
      ,"attribute": {label:"attribute"}
      ,"value": {label:"value"}
      ,"from_GUID": {label: "from_GUID"}
      ,"to_GUID": {label: "to_GUID"}
      ,"item_GUID": {label: "item_GUID"}
      ,"user_GUID": {label: "user_GUID"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
  }

  this.node.M_MetaData = {
    nodeLabel:"M_MetaData"
    ,orderBy:[{"name":"name"}]
    ,fieldsDisplayed: ["name", "nodeLabel", "fields"]
    ,formFieldsDisplayed: ["name", "nodeLabel", "fields", "fieldsDisplayed", "formFieldsDisplayed"]
    ,fields: {
      "name": {label: "DB name"}
      ,"nodeLabel": {label: "Display name"}
      ,"fields": {label: "All fields"}
      ,"fieldsDisplayed": {label: "Table fields"}
      ,"formFieldsDisplayed": {label: "Form fields"}
      ,"orderBy": {label: "Order by"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
  }

  this.node.M_Session = {
    nodeLabel:"M_Session"
    ,orderBy:[{"name":"startTime"}, {"name":"endTime"}]
    ,fieldsDisplayed: ["startTime", "endTime", "GUID"]
    ,formFieldsDisplayed: ["startTime", "endTime", "GUID"]
    ,fields: {
      "startTime": {label: "Start time"}
      ,"endTime": {label: "End time"}
      ,"comment": {label: "Comment", input:{name:"textarea"}}
      ,"M_GUID": {label: "GUID"}
    }
  }

  this.node.M_Browser = {
    nodeLabel:"M_Browser"
    ,orderBy:[{"name":"name"}]
    ,fieldsDisplayed: ["name"]
    ,formFieldsDisplayed: ["name"]
    ,fields: {
      "name": {label:"name"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
  }

  this.node.M_Widget = {
    nodeLabel:"M_Widget"
    ,orderBy: [{"name":"name"}, {"name":"help"}]
    ,fieldsDisplayed: ["name", "help"]
    ,formFieldsDisplayed: ["name", "help"]
    ,fields: {
      "name": {label:"Name"}
      ,"help": {label:"Help"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
  }

  this.node.M_DataSharePartner = {
    nodeLabel:"Data Share Partner"
    ,orderBy: [{"name":"IPaddress"}]
    ,fieldsDisplayed: ["IPaddress", "localLastChange", "partnerLastChange", "comment"]
    ,formFieldsDisplayed: ["IPaddress", "localLastChange", "partnerLastChange", "comment"]
    ,fields: {
      "IPaddress": {label:"IP address"}
      ,"localLastChange": {label:"Last local changelog #"}
      ,"partnerLastChange": {label:"Last remote changelog #"}
      ,"comment":    {label: "Comment", input:{name:"textarea"}}
    }
  }
} ////// end method

} ////////////////////////////////////////////////////// end class
