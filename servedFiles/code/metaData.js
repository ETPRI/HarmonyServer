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

// Initializes the objects representing different types of relations. So far there's only one, called "link".
// All objects are stored as key/value pairs in this.relation. The objects include a label for the type of link,
// and a list of fields which should be stored for this type of link with their labels.
initRelationData(){
  this.relation.link = {
     nodeLabel: "link"
    ,fields: {
    	"comment":   {label: "Comment"}
    }}

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
    ,"comment":    {label: "Comment"   }
    }}

  this.node.organization = {
     nodeLabel: "organization"
    ,orderBy: [{"name":"name"}, {"name":"web"}, {"name":"comment"}]
    ,fieldsDisplayed: ["name", "web"]
    ,formFieldsDisplayed: ["name", "web"]
    ,fields: {"name":       {label: "Name" }
      ,"web":      {label: "Web"}
      ,"comment":  {label: "Comment"  }
    }}

  this.node.topic = {
     nodeLabel: "topic"
    ,orderBy: [{"name":"name"}, {"name":"comment"}]
    ,fieldsDisplayed: ["name", "comment"]
    ,formFieldsDisplayed: ["name", "comment"]
    ,fields: {"name":       {label: "Name" }
      ,"comment":    {label: "Comment"}
    }}


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
    ,"comment":    {label: "Comment"  }
    }}

  this.node.mindmap = {
    nodeLabel: "mindmap"
    ,orderBy: [{"name":"name"}, {"name":"comment"}] // ,lastEdited, created, lastEditor, creator
    ,fieldsDisplayed: ["name", "comment"] // , "creator", "created", "lastEditor", "lastEdited"
    ,formFieldsDisplayed: ["name", "comment"] // , "creator", "created", "lastEditor", "lastEdited"
    ,fields: {
      "name":         {label: "Name"}
      ,"comment":     {label: "Comment"}
      // ,"creator":     {label: "Created by"}  // Add this stuff later - have to research how to search by a date
      // ,"created":     {label: "Created on", type: "date"}
      // ,"lastEditor":  {label: "Last edited by"}
      // ,"lastEdited":  {label: "Last edited on", type: "date"}
    }}

    this.node.calendar = {
      nodeLabel: "calendar"
      ,orderBy: [{"name":"name"}, {"name":"description"}]
      ,fieldsDisplayed: ["name", "description"]
      ,formFieldsDisplayed: ["name", "description"]
      ,fields: {
        "name": {label: "Name"}
        ,"description": {label: "Description"}
        // Add more here later - probably search criteria (each calendar is like a different search for events)
      }
    }

    this.node.M_View = {
      nodeLabel: "M_View"
      ,orderBy: [{"name":"direction"}, {"name":"order"}]
      ,fieldsDisplayed: ["direction", "order"]
      ,formFieldsDisplayed: ["direction", "order"]
      ,fields: {
        "direction": {label:"direction"}
        ,"order": {label:"order"}
      }
    }

    this.node.M_LoginTable = {
      nodeLabel: "M_Login Table"
      ,orderBy: [{"name":"name"}]
      ,fieldsDisplayed: ["name"]
      ,formFieldsDisplayed: ["name"]
      ,fields: {
        "name": {label:"name"}
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
      }
    }

    this.node.M_Session = {
      nodeLabel:"M_Session"
      ,orderBy:[{"name":"startTime"}, {"name":"endTime"}]
      ,fieldsDisplayed: ["startTime", "endTime"]
      ,formFieldsDisplayed: ["startTime", "endTime"]
      ,fields: {
        "startTime": {label: "Start time"}
        ,"endTime": {label: "End time"}
      }
    }

    this.node.M_Browser = {
      nodeLabel:"M_Browser"
      ,orderBy:[{"name":"name"}]
      ,fieldsDisplayed: ["name"]
      ,formFieldsDisplayed: ["name"]
      ,fields: {
        "name": {label:"name"}
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
      }
    }
} ////// end method

} ////////////////////////////////////////////////////// end class
