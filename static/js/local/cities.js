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
        var prevTurn = null;
        for(var i=0; i<app.Constants.TURN_COUNT; i++) {
            var turn = new app.CityTurn();
            if (prevTurn) {
                turn.prevTurn = prevTurn;
            }
            this.turns.add(turn);
            prevTurn = turn;
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
            turn.calculateFromPrevious()
        }

        this.trigger("reset");
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
    },
    calculateFromPrevious: function() {
        var prev = this.prevTurn;
        this.set("turn", prev.get('turn') + 1);
        this.set("pop", prev.get('pop'));
        this.set("food", prev.get('food'));
        this.set("hammers", prev.get('hammers'));

        this.tileGrid.setTiles(prev.tileGrid);
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
    render: function() {
        console.log("Turn render! %o", this.model.toJSON());
        this.$el.html(this.template(this.model.toJSON()));
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
                var renderedTile = this.tileTemplate(this.model.getTile(x,y));
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
        this.stopListening(this.model);
        this.model = model;
        this.listenTo(this.model, "change", this.render);
        this.render();
    },
    editTile: function(e) {
        console.log("Edit tile! %o", this);
        var $el = $(e.currentTarget);
        var x = parseInt($el.attr('data-x'));
        var y = parseInt($el.attr('data-y'));

        this.tilePopupView.popup(this.model, x, y);
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
        this.model.trigger("change");
    }
});

app.CityView = Backbone.View.extend({
    el: $("#city"),

    headerTemplate: _.template($('#city-header-template').html()),

    events: {
        "click.tr": "selectRow"
    },
    initialize: function() {
        this.listenTo(this.model, 'reset', this.addAll);

        this.tileGridView = new app.TileGridView({});

        console.log("Initialize!");

        this.render();

        this.model.generateTurns();
        this.selectTurn(this.model.turns.first().cid);
    },
    render: function() {
        console.log('render!');

        this.$('#city-header').html(this.headerTemplate({}));
    },
    addOne: function(item) {
        console.log('add one! %o', item);
        var turnView = new app.CityTurnView({model: item});
        var rendered = turnView.render().el;
        this.$("#city-turns").append(rendered);
    },
    addAll: function() {
        console.log('add all! %o', this.model.turns);
        this.model.turns.each(this.addOne, this);
    },
    selectTurn: function(turnCid) {
        this.selectedTurn = turnCid;

        this.tileGridView.setModel(this.model.turns.get(this.selectedTurn).tileGrid);

        this.$('tr.info').removeClass('info');
        this.$('tr[data-cid=' + turnCid + ']').addClass('info');
    },
    selectRow: function(e) {
        console.log("Select row!");
        this.selectTurn($(e.target).parent('tr').attr('data-cid'));
    }
})

$(function() {
    app.city = new app.City();
    app.cityView = new app.CityView({model: app.city});

});