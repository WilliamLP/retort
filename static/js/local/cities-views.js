"use strict";

var app = app || {};

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
        tileStrings.sort(function(a,b) { return b > a; });
        return tileStrings.length ? tileStrings.join(', ') : "(none)";
    },
    noteString: function() {
        var notes = [];
        var info = this.model.info();

        if (this.model.index > 0 && !this.model.tileGrid.equals(this.model.prev.tileGrid)) {
            notes.push("Tile yields changed.");
        }
        if (info.food + info.foodSurplus >= info.foodToGrow) {
            notes.push("Grow to size " + (info.pop + 1) + ".");
        }
        if (info.build.name && info.hammers + info.hammersProduced >= info.build.hammers) {
            notes.push("Finished " + info.build.name + ".");
        }
        if (info.build.name && info.hammers == 0) {
            notes.push("Started " + info.build.name + ".");
        }

        return notes.join(' ');
    },
    render: function() {
        var viewParams = this.model.info();

        viewParams['tilesWorked'] = this.tilesWorkedString();
        viewParams['note'] = this.noteString();
        viewParams['validTiles'] = (this.model.get('pop') + 1 == this.model.numberSelected());

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
        this.editTilePopupView = new app.EditTilePopupView({});
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

        this.editTilePopupView.popup(this.model, x, y);
    }
});

app.EditTilePopupView = Backbone.View.extend({
    el: $("#tile-popup"),
    events: {
        "hide.bs.modal": "closeView"
    },
    popup: function(model, x, y) {
        console.log("Tile popup! %o");

        this.model = model;
        this.tile = model.tileGrid.getTile(x, y);

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

        if (this.tile.f != f || this.tile.h != h || this.tile.c != c) {
            this.model.tileGrid.setTile(this.tile.x, this.tile.y, {"f": f, "h": h, "c": c});
            this.model.city.propagateTileChanges(this.model.index);
            this.model.city.trigger('reset');
        }
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

app.BuildSelectPopupView = Backbone.View.extend({
    template: _.template($('#build-select-template').html()),
    el: $("#build-select-popup"),
    events: {
        "change select[name='build-preset']": "selectPreset",
        "hide.bs.modal": "closeView"
    },
    popup: function(model) {
        this.model = model;

        this.render();

        this.$el.modal('show');
        return this;
    },
    render: function() {
        this.$('.modal-body').html(this.template({presets: app.BuildPresets, build: this.model.build}));
    },
    initialize: function() {
    },
    selectPreset: function(e) {
        var buildName = this.$('option:selected').text();
        var selectedPreset = this.model.buildPresetForName(buildName);

        if (selectedPreset) {
            this.$('input[name="build-name"]').val(selectedPreset.name);
            this.$('input[name="build-hammers"]').val(selectedPreset.hammers);
            this.$('input[name="build-bonus"]').val(selectedPreset.bonus);
        }
    },
    closeView: function() {
        var buildName = this.$('input[name="build-name"]').val();
        var buildHammers = parseInt(this.$('input[name="build-hammers"]').val()) || 0;
        var buildBonus = parseInt(this.$('input[name="build-bonus"]').val()) || 0;

        this.model.setBuild({name: buildName, hammers: parseInt(buildHammers), bonus: parseInt(buildBonus)});

        this.model.city.trigger("reset");
    }
});

app.CityView = Backbone.View.extend({
    el: $("#city"),

    headerTemplate: _.template($('#city-header-template').html()),

    events: {
        "click tr": "selectRow",
        "click .tile-select": "selectTiles",
        "click .build-select": "selectBuild",
        "click #save-city": "save",
        "click #load-city": "load"
    },
    initialize: function() {
        this.tileGridView = new app.TileGridView({});
        this.tileSelectPopupView = new app.TileSelectPopupView({});
        this.buildSelectPopupView = new app.BuildSelectPopupView({});

        this.listenTo(this.model, 'reset', this.addAll);
        this.listenTo(this.tileSelectPopupView, 'change', this.addAll);

        this.model.generateTurns();
        this.setSelectedTurn(this.model.turns.first().cid);

        this.render();

    },
    render: function() {
        this.$('#city-header').html(this.headerTemplate({}));
    },
    renderSelectedTurn: function() {
        this.$('tr.info').removeClass('info');
        this.$('tr[data-cid=' + this.selectedTurn + ']').addClass('info');
    },
    addOne: function(item) {
        var turnView = new app.CityTurnView({model: item});
        var rendered = turnView.render().el;
        this.$("#city-turns").append(rendered);
    },
    addAll: function() {
        this.$("#city-turns").empty();
        this.model.turns.each(this.addOne, this);
        this.renderSelectedTurn();
    },
    setSelectedTurn: function(turnCid) {
        this.selectedTurn = turnCid;
        this.tileGridView.setModel(this.model.turns.get(this.selectedTurn));

        this.renderSelectedTurn();
    },
    selectRow: function(e) {
        this.setSelectedTurn($(e.target).closest('tr').attr('data-cid'));
    },
    selectTiles: function(e) {
        var turnCid = $(e.target).closest('tr').attr('data-cid');
        this.tileSelectPopupView.popup(this.model.turns.get(turnCid));
    },
    selectBuild: function(e) {
        var turnCid = $(e.target).closest('tr').attr('data-cid');
        this.buildSelectPopupView.popup(this.model.turns.get(turnCid));
    },
    save: function(e) {
        this.model.save($('#city-filename').val().trim());
    },
    load: function(e) {
        this.model.load($('#city-filename').val().trim());

        this.addAll();
    }
})

$(function() {
    app.city = new app.City();
    app.cityView = new app.CityView({model: app.city});

});