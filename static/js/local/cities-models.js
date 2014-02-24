"use strict";

var app = app || {};

app.Constants = {
    TURN_COUNT: 100
}

app.BuildPresets = [
    {name: "Worker", hammers: 60, foodhammers: true},
    {name: "Worker (EXP)", hammers: 60, foodhammers: true, bonus: 25},
    {name: "Settler", hammers: 100, foodhammers: true},
    {name: "Settler (IMP)", hammers: 60, foodhammers: true, bonus: 50},
    {name: "Warrior", hammers: 15},
    {name: "Work Boat", hammers: 30},
    {name: "Granary", hammers: 60, granary: true},
    {name: "Granary (EXP)", hammers: 60, bonus: 100, granary: true}
];

app.City = Backbone.Model.extend({
    defaults: function() {
        return {
            start_turn: 0,
            start_pop: 1,
            start_food: 0,
            start_hammers: 0
        };
    },
    initialize: function() {
        this.turns = new app.CityTurnList();
        for(var i=0; i<app.Constants.TURN_COUNT; i++) {
            var turn = new app.CityTurn();
            turn.prev = (i >= 1) ? this.turns.at(i-1) : null;
            turn.city = this;
            turn.index = i;
            this.turns.add(turn);
        }
    },
    save: function(filename) {
        if (filename == '') {
            return false;
        }
        console.log("save %s", filename);
        localStorage.setItem('city-' + filename, JSON.stringify(this.toJSON()));
    },
    load: function(filename) {
        if (filename == '') {
            return false;
        }
        console.log("load %s", filename);
        var encoded = JSON.parse(localStorage.getItem('city-' + filename));
        this.setFromJSON(encoded);

        this.recalc();
    },
    generateTurns: function() {
        var firstTurn = this.turns.at(0);
        firstTurn.set("turn", this.get("start_turn"));
        firstTurn.set("pop", this.get("start_pop"));
        firstTurn.set("food", this.get("start_food"));
        firstTurn.set("hammers", this.get("start_hammers"));

        this.recalc();

        this.trigger("reset");
    },
    recalc: function() {
        for(var i=1; i<app.Constants.TURN_COUNT; i++) {
            var turn = this.turns.at(i);
            turn.calculateFromPrevious();
        }
    },
    propagateTileSelections: function(startIndex) {
        var selected = this.turns.at(startIndex).selectedTiles;
        for(var i=startIndex+1; i<app.Constants.TURN_COUNT; i++) {
            this.turns.at(i).selectedTiles = _.clone(selected);
        }

        this.recalc();
        this.trigger("change");
    },
    propagateTileChanges: function(startIndex) {
        var grid = this.turns.at(startIndex).tileGrid;
        for(var i=startIndex+1; i<app.Constants.TURN_COUNT; i++) {
            this.turns.at(i).tileGrid.setTiles(grid);
        }

        this.recalc();
        this.trigger("change");
    },
    propagateBuild: function(startIndex) {
        var build = this.turns.at(startIndex).build;
        for(var i=startIndex+1; i<app.Constants.TURN_COUNT; i++) {
            this.turns.at(i).build = _.clone(build);
        }

        this.recalc();
        this.trigger("change");
    },
    toJSON: function() {
        var encoded = {};
        for(var i=0; i<app.Constants.TURN_COUNT; i++) {
            encoded['t' + i] = this.turns.at(i).toJSON();
        }
        return encoded;
    },
    setFromJSON: function(encoded) {
        for(var i=0; i<app.Constants.TURN_COUNT; i++) {
            this.turns.at(i).setFromJSON(encoded['t' + i]);
        }
        return encoded;
    }
});

app.CityTurn = Backbone.Model.extend({
    defaults: function() {
        return {
            turn: 0,
            pop: 1,
            food: 0,
            overflowHammers: 0
        };
    },
    initialize: function() {
        this.tileGrid = new app.TileGrid();
        this.tileGrid.turn = this;
        this.selectedTiles = {"2,2": true};
        this.build = {};
        this.buildHammers = {};
    },
    calculateFromPrevious: function() {
        var prevInfo = this.prev.info();
        var attrs = {};

        attrs.turn = prevInfo.turn + 1;

        // FOOD
        var growth = 0;
        attrs.food = prevInfo.food + prevInfo.foodSurplus;
        if (attrs.food >= prevInfo.foodToGrow) {
            growth = 1;
            attrs.food -= prevInfo.foodToGrow;
        }
        attrs.pop = prevInfo.pop + growth;
        this.set(attrs);

        // HAMMERS
        this.buildHammers = _.clone(prevInfo.buildHammers);
        this.attributes.overflowHammers = 0;
        if(prevInfo.build.name) {
            this.buildHammers[prevInfo.build.name] += prevInfo.hammersProduced;
            if (this.buildHammers[prevInfo.build.name] >= prevInfo.build.hammers) {
                // Build finished
                this.attributes.overflowHammers = this.buildHammers[prevInfo.build.name] - prevInfo.build.hammers;
                this.buildHammers[prevInfo.build.name] = 0;
            }
        }

    },
    info: function() {
        var info = this.attributes;
        info.build = this.build;
        info.buildHammers = this.buildHammers;

        // Output derived from tiles
        info.foodWorked = 0;
        info.hammersProduced = 0;
        info.commerceProduced = 0;
        $.each(this.selectedTileList(), function(k, tile) {
            info.foodWorked += tile.f;
            info.hammersProduced += tile.h;
            info.commerceProduced += tile.c;
        });

        // Derived food info
        info.foodCost = info.pop * 2;
        info.foodSurplus = (info.build.foodhammers && info.foodWorked > info.foodCost) ? 0 : info.foodWorked - info.foodCost;
        info.foodToGrow = 2*info.pop + 20;

        // Derived hammer info
        info.hammersProduced += info.overflowHammers;
        if (info.build.bonus) {
            info.hammersProduced += Math.floor(info.hammersProduced * info.build.bonus / 100);
        }
        if (info.build.foodhammers && info.foodWorked > info.foodCost) {
            info.hammersProduced += info.foodWorked - info.foodCost;
        }

        if(info.build.name && !info.buildHammers[info.build.name]) {
            info.buildHammers[info.build.name] = 0;
        }
        info.hammers = info.buildHammers[this.build.name];
        info.buildFinished = (info.buildHammers[info.build.name] + info.hammersProduced >= info.build.hammers);

        return info;
    },
    numberSelected: function() {
        return _.keys(this.selectedTiles).length;
    },
    isTileSelected: function(x, y) {
        var key = x + "," + y;
        return (key in this.selectedTiles);
    },
    selectedTileList: function() {
        var result = [];

        for(var x=0; x<5; x++) {
            for(var y=0;  y<5; y++) {
                var key = x + ',' + y;
                if (key in this.selectedTiles) {
                    result.push(this.tileGrid.getTile(x,y));
                }
            }
        }
        return result;
    },
    selectTile: function(x, y) {
        var key = x + "," + y;
        if (key in this.selectedTiles) {
            return false;
        }
        if (this.numberSelected() >= this.get('pop') + 1) {
            return false;
        }

        this.selectedTiles[key] = true;

        this.city.propagateTileSelections(this.index);
        this.trigger('change');

        return true;
    },
    unselectTile: function(x, y) {
        var key = x + "," + y;
        if (key == '2,2' || !(key in this.selectedTiles)) {
            return false;
        }
        delete this.selectedTiles[key];

        this.city.propagateTileSelections(this.index);
        this.trigger('change');

        return true;
    },
    buildPresetForName: function(name) {
        var foundPreset = null;
        $.each(app.BuildPresets, function(k, preset) {
            if (preset.name == name) {
                foundPreset = preset;
            }
        });
        return foundPreset;
    },
    setBuild: function(params) {
        this.build = {name: params.name, hammers: params.hammers, bonus: params.bonus, }
        // Already a preset? Get the "hidden" info, like whether the build is foodhammers
        var preset = this.buildPresetForName(params.name);
        if (preset && preset.foodhammers) {
            this.build.foodhammers = true;
        }
        if (preset && preset.granary) {
            this.build.granary = true;
        }
        this.city.propagateBuild(this.index);
        this.trigger('change');
    },
    toJSON: function() {
        return {
            tileGrid: this.tileGrid.tiles,
            selectedTiles: this.selectedTiles,
            build: this.build
        };
    },
    setFromJSON: function(encoded) {
        this.tileGrid.setTilesFromArray(encoded.tileGrid);
        this.selectedTiles = encoded.selectedTiles;
        this.build = encoded.build;
    }
});

app.CityTurnList = Backbone.Collection.extend({
    model: app.CityTurn
    //url: '/sequence/sequence/'
});


app.TileGrid = Backbone.Model.extend({
    getTile: function(x, y) {
        return this.tiles[x][y];
    },
    setTile: function(x, y, attrs) {
        this.tiles[x][y].f = attrs.f;
        this.tiles[x][y].h = attrs.h;
        this.tiles[x][y].c = attrs.c;

        this.trigger('change');
    },
    setTiles: function(sourceTileGrid) {
        for(var x=0; x<5; x++) {
            for(var y=0;  y<5; y++) {
                this.setTile(x, y, sourceTileGrid.getTile(x,y));
            }
        }
    },
    setTilesFromArray: function(arr) {
        this.tiles = arr;
        this.trigger('change');
    },
    equals: function(otherTileGrid) {
        for(var x=0; x<5; x++) {
            for(var y=0;  y<5; y++) {
                if (this.tiles[x][y].f != otherTileGrid.tiles[x][y].f ||
                        this.tiles[x][y].h != otherTileGrid.tiles[x][y].h ||
                        this.tiles[x][y].c != otherTileGrid.tiles[x][y].c) {
                    return false;
                }
            }
        }
        return true;
    },
    initialize: function() {
        this.tiles = [];
        for(var x=0; x<5; x++) {
            var col = []
            for(var y=0;  y<5; y++) {
                var tile = {
                    "f": 0,
                    "h": 0,
                    "c": 0,
                    "x": x,
                    "y": y,
                    "valid": !((x==0 || x==4) && (y==0 || y==4)) // Corners are not valid selections
                };

                if (x==2 && y==2) {
                    tile.f = 2;
                    tile.h = 1;
                    tile.c = 1;
                }
                col.push(tile);
            }
            this.tiles.push(col);
        }
    }
});