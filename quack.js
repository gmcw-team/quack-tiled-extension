var tool = tiled.registerTool('PushToQuack', {
    name: "Push To Quack",
    icon: "quack_icon_32.png",
    iconVisibleInMenu: true,
})

var tool = tiled.registerTool('SyncTilemaps', {
    name: "Sync Tilemaps with GM",
    icon: "quack_icon_32.png",
    iconVisibleInMenu: true,


})

tiled.extendMenu("File", [
    { action: "PushToQuack", before: "Export" },
    { separator: true }
]);

tiled.extendMenu("File", [
    { action: "SyncTilemaps", before: "Export" },
    { separator: true }
]);


// var doc = new XMLHttpRequest();
// doc.onreadystatechange = function() {
//   if (doc.readyState == XMLHttpRequest.DONE) {
//     var a = doc.response;
//
//     tiled.alert(a);
//   }
// }
//
// doc.open("GET", "http://worldtimeapi.org/api/ip");
// doc.send();