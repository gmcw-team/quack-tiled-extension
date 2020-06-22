
// *** Utility functions ***
function yyRead(path) {
  let yyFile;
  try {
    yyFile = new TextFile(path);
  } catch (error) {
    tiled.alert("Could not read file, please check the 'GMS2 Project' property points to a valid GMS2 project\n\n" + path);
    tiled.error(error, ()=>{});
    return;
  }

  const yyStr = yyFile.readAll();
  const yy = JSON.parse(yyStr);
  if (typeof yy !== 'object') {
    tiled.alert("Could not parse YY, please check the 'GMS2 Project' property points to a valid GMS2 project\n\n" + path);
    tiled.error(error, ()=>{});
    return;
  }

  return yy;
}

function checkSetFormat(map) {
  // check and set layer data format
  let errs = ""
  if (map.orientation != TileMap.Orthogonal) {
    errs += "Map orientation is not orthogonal!\n";
  }
  if (map.layerDataFormat != TileMap.Base64Zlib) {
    errs += "Map data format is not Base64Zlib!\n";
  }
  if (map.renderOrder != TileMap.RightDown) {
    errs += "Map render order is not Right Down!\n";
  }

  return errs;
}

// *** Push data to tiled online ***
let pushAction = tiled.registerAction('PushToQuack', function(action) {
  const map = tiled.activeAsset;
  if (!map.isTileMap) {
    tiled.alert("Active document is not a TileMap! Please open or switch to a TileMap to sync.");
    return;
  }

  if (map.modified) {
    tiled.alert("Document was modified! Please save before pushing.");
    return;
  }

  // make sure settings are correct
  const errs = checkSetFormat(map);
  if (errs) {
    tiled.alert("The following configuration were incorrect, please correct them and try again\n\n"+errs);
    return;
  }

  // make sure none of the tilesets are loaded in externally
  let externals = map.tilesets.filter(tileset => tileset.fileName).map(tileset => tileset.name);
  if (externals.length) {
    tiled.alert(
      "The following Tilesets use external files, this is not supported currently, please embed them in this map\n\n" +
      externals.join("\n"));
    return;
  }

  // check and set API secret key
  let apiSecret = map.property("Quack Secret Key");
  if (!apiSecret) {
    apiSecret = tiled.prompt("Please enter your Quack secret key from https://quack.games",
    "",
    "Please enter your secret key"
    );

    if (!apiSecret) {
      tiled.alert("No key entered, aborting sync");
      return;
    }

    map.setProperty("Quack Secret Key", apiSecret);
  }

  // interpret API key for user and game
  const [temp, user, game, token] = apiSecret.split(":", 4);
  const tilemapName = FileInfo.baseName(map.fileName);

  try {
    tmxFile = new TextFile(map.fileName);
  } catch (error) {
    tiled.alert("Could not read project");
    tiled.error(error, ()=>{});
    return;
  }

  const tmxStr = tmxFile.readAll();

  var doc = new XMLHttpRequest();
  doc.onreadystatechange = function() {
    if (doc.readyState == XMLHttpRequest.DONE) {
      if (doc.status === 200) {
        tiled.error(doc.response, ()=>{});
        tiled.alert("Push complete");
      }
      else if (doc.status === 403) {
        tiled.error(doc.response, ()=>{});
        tiled.alert("Push failed, please check your Quack Secret key from https://quack.games");
      }
      else {
        tiled.error(doc.response, ()=>{});
        tiled.alert("Push failed with status code " + doc.status);
      }
    }
  }
  doc.open("PUT", `http://localhost:5000/api/quack/users/${user}/games/${game}/tilemaps/${tilemapName}`);
  doc.setRequestHeader("Content-Type", "application/xml");
  doc.setRequestHeader("Authorization", `Basic ${apiSecret}`);
  doc.send(tmxStr);

});
pushAction.text = "Push To Quack";
pushAction.icon = "quack_icon_32.png";
pushAction.iconVisibleInMenu = true;


// *** Synchronize between GM project and Tiled project ***
let syncAction = tiled.registerAction('SyncTilemaps', function(action) {
  const map = tiled.activeAsset;
  if (!map.isTileMap) {
    tiled.alert("Active document is not a TileMap! Please open or switch to a TileMap to sync.");
    return;
  }

  // make sure settings are correct
  const errs = checkSetFormat(map);
  if (errs) {
    map.orientation = TileMap.Orthogonal;
    map.layerDataFormat = TileMap.Base64Zlib;
    map.renderOrder = TileMap.RightDown;
    tiled.allert("The following configuration was incorrect, they have been automatically corrected:\n\n"+errs);
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
  let ignoreProperty = map.property("GMS2 Ignored Layers");
  let ignoreList = ignoreProperty? ignoreProperty.split(",") : [];

  let updatedImage = false;

  const yypDir = FileInfo.path(yypPath);
  yyp.resources.filter(res => res.Value.resourceType == "GMTileSet").map(res => {
    const tileSetResource = FileInfo.joinPaths(yypDir, res.Value.resourcePath);
    const tileSetYy = yyRead(tileSetResource);
    const tileSetName = tileSetYy.name;

    // skip if in ignore list
    if (ignoreList.includes(tileSetName)) {
      return;
    }

    // sanity checks
    if (tileSetYy.tilexoff !== tileSetYy.tileyoff) { // TODO: add ignore list
      let answer = tiled.confirm(
        "Tileset " + tileSetName + " has different x and y offsets. Tiled only supports same offset in x and y.\n" +
        "This tileset will be skipped. Do you want to ignore this tileset next time?",
        "Compatibility warning",
      );
      if (answer) {
        ignoreList.push(tileSetName);
      }
      return;
    }

    if (tileSetYy.tilehsep !== tileSetYy.tilevsep) {
      let answer = tiled.confirm(
        "Tileset " + tileSetName + " has different h and v separation/spacing. Tiled only supports same separation/spacing for h and v.\n" +
        "This tileset will be skipped. Do you want to ignore this tileset next time?",
        "Compatibility warning",
      );
      if (answer) {
        ignoreList.push(tileSetName);
      }
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

    if (tileSetYy.tilexoff !== 0 && tileSetYy.tilexoff != tileset.margin) {
      tiled.alert("Tileset " + tileSetName + " has non-zero offset. Tiled supports this but tileset must edited by hand to set offset");
    }

    if (tileset.image != spriteImg) {
      updatedImage = true;
      tileset.image = spriteImg;
    }
    tileset.setTileSize(tileSetYy.tilewidth, tileSetYy.tileheight);
  });

  // update ignore list
  map.setProperty("GMS2 Ignored Tilesets", ignoreList.join(","));

  // fetch all object names from gamemaker
  const yypObjects = yyp.resources.filter(res => res.Value.resourceType == "GMObject").map(res => {
    const objectResource = FileInfo.joinPaths(yypDir, res.Value.resourcePath);
    const objectYy = yyRead(objectResource);
    return objectYy.name;
  })

  // check if all objects in tmx match gamemaker objects
  function getLayerObjects(layer, validObjects) {
    // Get flattened list of layer names
    let objects = [];

    for (let i=0; i<layer.layerCount; i++) {
      let thisLayer = layer.layerAt(i);
      if (thisLayer.isGroupLayer) {
        // recurse if group layer
        objects = objects.concat(getLayerObjects(thisLayer, validObjects));
      }
      else if (thisLayer.isObjectLayer) {
        // loop over objects inside object layer
        for (let j=0; j<thisLayer.objectCount; j++) {
          let obj = thisLayer.objects[j];

          // skip if explicitly ignored
          if (obj.property("GMS2 Ignored")) {
            continue
          }

          // check if object is in validObjects, and generate message
          if (!obj.name || !validObjects.includes(obj.name)) {
            objects.push("Object "+(obj.name ? "named '"+obj.name+"'" : "with no name")+" on layer "+thisLayer.name);
          }
        }
      }
    }

    return objects;
  }

  const invalid_objects = getLayerObjects(map, yypObjects);
  if (invalid_objects.length) {
    tiled.alert(
      "Warning, the following objects have names that don't match the objects in your GM project\n\n" +
      invalid_objects.join("\n") + "\n\n" +
      "To ignore, set a property named 'GMS2 Ignored' to True in their custom properties"
    );
  }

  // This is needed due to a current bug in Tiled 1.4.0. I submitted a git issue
  if (updatedImage) {
    tiled.alert("Sync complete. Please save and reload the project to clear file read warnings");
  }
  else {
    tiled.alert("Sync complete");
  }
});
syncAction.text = "Sync Tilemaps with GM";
syncAction.icon = "quack_icon_32.png";
syncAction.iconVisibleInMenu = true;


// *** Set up Menu entries ***
tiled.extendMenu("File", [
    { action: "PushToQuack", before: "Close" },
]);

tiled.extendMenu("File", [
    { action: "SyncTilemaps", before: "Close" },
    { separator: true }
]);

// on-load check if setting should be anbled, and register as signal
function updateMenu(asset) {
  if (asset && asset.isTileMap) {
    syncAction.enabled = true;
    pushAction.enabled = true;
  }
  else {
    syncAction.enabled = false;
    pushAction.enabled = false;
  }
}
updateMenu(tiled.activeAsset);
tiled.activeAssetChanged.connect(updateMenu);

