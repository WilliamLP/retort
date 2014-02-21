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
        this.tileGrid = new app.TileGrid();
    },
    generateNextTurn: function(curTurn) {
        var nextTurn = new app.CityTurn();
        nextTurn.set("turn", curTurn.get('turn') + 1);
        nextTurn.set("pop", curTurn.get('pop'));
        nextTurn.set("food", curTurn.get('food'));
        nextTurn.set("hammers", curTurn.get('hammers'));

        return nextTurn;
    },
    generateTurns: function() {
        console.log("Generate turns!");

        this.turns.reset();

        var firstTurn = new app.CityTurn();
        firstTurn.set("turn", this.get("start_turn"));
        firstTurn.set("pop", this.get("start_pop"));
        firstTurn.set("food", this.get("start_food"));
        firstTurn.set("hammers", this.get("start_hammers"));


        this.turns.add(firstTurn);

        var curTurn = firstTurn;
        for(var i=1; i<app.Constants.TURN_COUNT; i++) {
            nextTurn = this.generateNextTurn(curTurn);
            this.turns.add(nextTurn);
            curTurn = nextTurn;
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
    initialize: function() {
        this.tiles = [];
        for(var x=0; x<5; x++) {
            var col = []
            for(var y=0;  y<5; y++) {
                col.push({
                    "f": 0,
                    "h": 0,
                    "c": 0,
                    "x": x,
                    "y": y,
                    "valid": !((x==0 || x==4) && (y==0 || y==4)) // Corners are not valid selections
                })
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
        this.tilePopupView = opts.tilePopupView;

        this.render();
    },

    editTile: function(e) {
        console.log("Edit tile! %o", this);
        var $el = $(e.currentTarget);
        var x = parseInt($el.attr('data-x'));
        var y = parseInt($el.attr('data-y'));
        var tile = this.model.getTile(x,y);
        this.tilePopupView.popup(tile)
    }
});

app.TilePopupView = Backbone.View.extend({
    el: $("#tile-popup"),
    template: _.template($('#tile-popup-template').html()),
    events: {
    },
    popup: function(tile) {
        console.log("Tile popup! %o", tile);

        this.$el.find('.modal-content').html(this.template({}));
        this.$el.modal();

        return this;
    },
    initialize: function() {
    }
});

app.CityView = Backbone.View.extend({
    el: $("#city"),

    headerTemplate: _.template($('#city-header-template').html()),

    events: {

    },
    initialize: function() {
        this.listenTo(this.model, 'reset', this.addAll);

        // Subviews
        this.tilePopupView = new app.TilePopupView({});
        this.tileGridView = new app.TileGridView({tilePopupView: this.tilePopupView, model: app.city.tileGrid});

        console.log("Initialize!");

        this.render();

        this.model.generateTurns();
        //app.Sequences.fetch();
        //console.log('fetched %o', app.Sequences);
    },
    render: function() {
        console.log('render!');

        this.$('#city-header').html(this.headerTemplate({}));
    },
    addOne: function(item) {
        console.log('add one! %o', item);
        var turnView = new app.CityTurnView({model: item});
        rendered = turnView.render().el
        this.$("#city-turns").append(rendered);
    },
    addAll: function() {
        console.log('add all! %o', this.model.turns);
        this.model.turns.each(this.addOne, this);
    }
})

$(function() {
    app.city = new app.City();
    app.cityView = new app.CityView({model: app.city});
});