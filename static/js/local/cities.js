"use strict";

var app = app || {};

app.Constants = {
    TURN_COUNT: 100
}

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
        console.log("City initialize!");
        this.turns = new app.CityTurnList();
        for(var i=0; i<app.Constants.TURN_COUNT; i++) {
            var turn = new app.CityTurn();
            turn.city = this;
            turn.index = i;
            this.turns.add(turn);
        }
    },
    generateTurns: function() {
        console.log("Generate turns!");

        var firstTurn = this.turns.at(0);
        firstTurn.set("turn", this.get("start_turn"));
        firstTurn.set("pop", this.get("start_pop"));
        firstTurn.set("food", this.get("start_food"));
        firstTurn.set("hammers", this.get("start_hammers"));

        for(var i=1; i<app.Constants.TURN_COUNT; i++) {
            var turn = this.turns.at(i);
            turn.calculateFromPrevious(this.turns.at(i-1));
        }

        this.trigger("reset");
    },
    resetTileSelections: function(startIndex) {
        console.log("Resetting from turn %i", startIndex);
        var selected = this.turns.at(startIndex).selectedTiles;
        for(var i=startIndex+1; i<app.Constants.TURN_COUNT; i++) {
            this.turns.at(i).selectedTiles = _.clone(selected);
        }

        this.trigger("change");
    }
});

app.CityTurn = Backbone.Model.extend({
    defaults: function() {
        return {
            turn: 0,
            pop: 1,
            food: 0,
            hammers: 0,
            actions: [],
            results: []
        };
    },
    initialize: function() {
        this.tileGrid = new app.TileGrid();
        this.selectedTiles = {"2,2": true};
    },
    calculateFromPrevious: function(prev) {
        this.set("turn", prev.get('turn') + 1);
        this.set("pop", prev.get('pop'));
        this.set("food", prev.get('food'));
        this.set("hammers", prev.get('hammers'));

        this.tileGrid.setTiles(prev.tileGrid);
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

        this.city.resetTileSelections(this.index);
        this.trigger('change');

        return true;
    },
    unselectTile: function(x, y) {
        var key = x + "," + y;
        if (key == '2,2' || !(key in this.selectedTiles)) {
            return false;
        }
        delete this.selectedTiles[key];

        this.city.resetTileSelections(this.index);
        this.trigger('change');

        return true;
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

app.CityTurnView = Backbone.View.extend({
    tagName: 'tr',
    template: _.template($('#city-turn-template').html()),
    events: {
    },
    tilesWorkedString: function() {
        var tileStrings = [];
        var selected = this.model.selectedTileList();
        $.each(selected, function(k, v) {
            if (v.x == 2 && v.y == 2) {
                return;
            }
            var tileString = v.f + '/' + v.h + '/' + v.c;
            tileStrings.push(tileString);
        });
        return tileStrings.join();
    },
    render: function() {
        var viewParams = this.model.toJSON();

        viewParams['tilesWorked'] = this.tilesWorkedString();


        this.$el.html(this.template(viewParams));
        this.$el.attr('data-cid', this.model.cid);
        return this;
    },
    initialize: function() {
    }
});

app.TileGridView = Backbone.View.extend({
    el: $("#tile-grid"),
    tileTemplate: _.template($('#city-tile-template').html()),
    events: {
        "click .city-tile": "editTile"
    },
    render: function() {
        console.log("Tile grid render! %o", this.model.toJSON());
        var tileOutputs = [];
        for(var x=0; x<5; x++) {
            var col = []
            for(var y=0;  y<5; y++) {
                var renderedTile = this.tileTemplate(this.model.tileGrid.getTile(x,y));
                tileOutputs.push(renderedTile);
            }
        }

        this.$el.html(tileOutputs.join(''));
        return this;
    },
    initialize: function(opts) {
        this.tilePopupView = new app.TilePopupView({});
        if (opts.model) {
            this.setModel(opts.model);
        }
    },
    setModel: function (model) {
        this.stopListening();
        this.model = model;
        this.listenTo(this.model.tileGrid, "change", this.render);
        this.render();
    },
    editTile: function(e) {
        console.log("Edit tile! %o", this);
        var $el = $(e.currentTarget);
        var x = parseInt($el.attr('data-x'));
        var y = parseInt($el.attr('data-y'));

        this.tilePopupView.popup(this.model.tileGrid, x, y);
    }
});

app.TilePopupView = Backbone.View.extend({
    el: $("#tile-popup"),
    events: {
        "hide.bs.modal": "closeView"
    },
    popup: function(model, x, y) {
        console.log("Tile popup! %o");

        this.model = model;
        this.tile = model.getTile(x, y);

        this.$el.modal('show');
        this.$('.btn[name="Food"][value="' + this.tile.f + '"]').button('toggle');
        this.$('.btn[name="Prod"][value="' + this.tile.h + '"]').button('toggle');
        this.$('.btn[name="Commerce"][value="' + this.tile.c + '"]').button('toggle');


        return this;
    },
    initialize: function() {
    },
    closeView: function() {
        console.log('Close view!');
        var f = parseInt(this.$('.btn.active[name="Food"]').attr('value'));
        var h = parseInt(this.$('.btn.active[name="Prod"]').attr('value'));
        var c = parseInt(this.$('.btn.active[name="Commerce"]').attr('value'));

        this.model.setTile(this.tile.x, this.tile.y, {"f": f, "h": h, "c": c});
    }
});

app.TileSelectPopupView = Backbone.View.extend({
    tileTemplate: _.template($('#city-tile-template').html()),
    el: $("#tile-select-popup"),
    events: {
        "hide.bs.modal": "closeView",
        "click button": "toggleTile"
    },
    popup: function(model) {
        this.model = model;

        this.stopListening();
        this.changed = false;
        var self = this;
        this.listenTo(model, "change", function() { self.changed = true; console.log('change'); });

        this.render();

        this.$el.modal('show');
        return this;
    },
    render: function() {
        this.$('#modal-tile-grid').empty();
        for(var x=0; x<5; x++) {
            var col = []
            for(var y=0;  y<5; y++) {
                var renderedTile = this.tileTemplate(this.model.tileGrid.getTile(x,y));
                this.$('#modal-tile-grid').append(renderedTile);

                if (this.model.isTileSelected(x,y)) {
                    this.$('button[data-x=' + x + '][data-y=' + y + ']').removeClass('btn-default').addClass('btn-success');
                }
            }
        }

    },
    initialize: function() {
    },
    closeView: function() {
        console.log('Close view!');
        if (this.changed) {
            this.model.city.trigger("reset");
        }
    },
    toggleTile: function(e) {
        var btn = this.$(e.target);
        var x = parseInt(btn.attr('data-x'));
        var y = parseInt(btn.attr('data-y'));

        if (btn.hasClass('btn-default')) {
            if (this.model.selectTile(x,y)) {
                btn.removeClass('btn-default').addClass('btn-success');
            }
        } else {
            if (this.model.unselectTile(x,y)) {
                btn.removeClass('btn-success').addClass('btn-default');
            }
        }
    }
});

app.CityView = Backbone.View.extend({
    el: $("#city"),

    headerTemplate: _.template($('#city-header-template').html()),

    events: {
        "click tr": "selectRow",
        "click .tile-select": "selectTiles"
    },
    initialize: function() {
        this.tileGridView = new app.TileGridView({});
        this.tileSelectPopupView = new app.TileSelectPopupView({});

        this.listenTo(this.model, 'reset', this.addAll);
        this.listenTo(this.tileSelectPopupView, 'change', this.addAll);

        console.log("Initialize!");

        this.render();

        this.model.generateTurns();
        this.setSelectedTurn(this.model.turns.first().cid);
    },
    render: function() {
        console.log('render!');

        this.$('#city-header').html(this.headerTemplate({}));
    },
    addOne: function(item) {
        var turnView = new app.CityTurnView({model: item});
        var rendered = turnView.render().el;
        this.$("#city-turns").append(rendered);
    },
    addAll: function() {
        this.$("#city-turns").empty();
        this.model.turns.each(this.addOne, this);
    },
    refreshAll: function() {
        console.log('refresh all!');
        this.addAll();
    },
    setSelectedTurn: function(turnCid) {
        this.selectedTurn = turnCid;

        this.tileGridView.setModel(this.model.turns.get(this.selectedTurn));

        this.$('tr.info').removeClass('info');
        this.$('tr[data-cid=' + turnCid + ']').addClass('info');
    },
    selectRow: function(e) {
        console.log("Select row!");
        this.setSelectedTurn($(e.target).parent('tr').attr('data-cid'));
    },
    selectTiles: function(e) {
        console.log("Select tiles!");

        var turnCid = $(e.target).parent('tr').attr('data-cid');

        this.tileSelectPopupView.popup(this.model.turns.get(turnCid));

        return false;
    }
})

$(function() {
    app.city = new app.City();
    app.cityView = new app.CityView({model: app.city});

});