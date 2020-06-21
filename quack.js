function yyRead(path) {
  let yyFile;
  try {
    yyFile = new TextFile(path);
  } catch (error) {
    tiled.alert("Could not read file, please check the 'GMS2 Project' property points to a valid GMS2 project\n\n" + path);
    return;
  }

  const yyStr = yyFile.readAll();
  const yy = JSON.parse(yyStr);
  if (typeof yy !== 'object') {
    tiled.alert("Could not parse YY, please check the 'GMS2 Project' property points to a valid GMS2 project\n\n" + path);
    return;
  }

  return yy;
}


let pushAction = tiled.registerAction('PushToQuack', function(action) {
  const map = tiled.activeAsset;
});
pushAction.text = "Push To Quack";
pushAction.icon = "quack_icon_32.png";
pushAction.iconVisibleInMenu = true;


let syncAction = tiled.registerAction('SyncTilemaps', function(action) {
  const map = tiled.activeAsset;
  if (!map.isTileMap) {
    tiled.alert("Active document is not a TileMap! Please open or switch to a TileMap to sync.");
    return;
  }

  // check for project src property
  const yypPath = map.property("GMS2 Project");
  if (!yypPath) {
    map.setProperty("GMS2 Project", tiled.filePath(""));
    tiled.alert("Please set the 'GMS2 Project' property to your project's YYP file in Custom Properties before syncing");
    return;
  }

  // read yy
  yyp = yyRead(yypPath);

  // find tilesets and aff if new
  let updated = []
  const yypDir = FileInfo.path(yypPath);
  yyp.resources.filter(res => res.Value.resourceType == "GMTileSet").map(res => {
    const tileSetResource = FileInfo.joinPaths(yypDir, res.Value.resourcePath);
    const tileSetYy = yyRead(tileSetResource);
    const tileSetName = tileSetYy.name;


    // sanity checks
    if (tileSetYy.tilexoff !== 0 || tileSetYy.tileyoff !== 0) {
      tiled.alert("Tileset " + tileSetName + " has non-zero offset. Tiled supports this but tileset must editeb by hand to set offset");
    }

    if (tileSetYy.tilehsep !== tileSetYy.tilevsep) {
      tiled.alert("Tileset " + tileSetName + " has different h and v separation/spacing. Tiled only supports same separation/spacing for h and v");
      return;
    }

    // find sprite
    const spriteResource = yyp.resources.find(res => res.Key === tileSetYy.spriteId);
    const spriteResourcePath = FileInfo.joinPaths(yypDir, spriteResource.Value.resourcePath);
    const spriteYy = yyRead(spriteResourcePath);
    const spriteDir = FileInfo.path(spriteResourcePath);
    const spriteImg = FileInfo.joinPaths(spriteDir, spriteYy.frames[0].compositeImage.FrameId + ".png")

    let tileset = map.tilesets.find(tileset => tileset.name == tileSetName);
    if (!tileset) {
      tileset = new Tileset(tileSetName);
      map.addTileset(tileset);
    }
    
    tileset.image = spriteImg;
    tileset.setTileSize(tileSetYy.tilewidth, tileSetYy.tileheight);
  });

  tiled.alert("Please save and reload the project to clear file read warnings")
});
syncAction.text = "Sync Tilemaps with GM";
syncAction.icon = "quack_icon_32.png";
syncAction.iconVisibleInMenu = true;

tiled.extendMenu("File", [
    { action: "PushToQuack", before: "Close" },
]);

tiled.extendMenu("File", [
    { action: "SyncTilemaps", before: "Close" },
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