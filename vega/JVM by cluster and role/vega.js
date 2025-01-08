// JSON.stringify(VEGA_DEBUG.vega_spec)  // <-- if you use Vega
// JSON.stringify(VEGA_DEBUG.vegalite_spec)  // <-- if you use Vega-Lite

//VEGA_DEBUG.view.getState()
//VEGA_DEBUG.view.data('nodes_jvm')

{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "title": {
    "text": "JVM by cluster and role", 
    "color": "black"
  },
  "description": "Information about JVM on clusters",
  "padding": 15,
  "background": "#FFFFFF",
  "config": {
    "title": { "fontSize": 20 }
  },
  "data": [
    {
      "name": "clusters",
      "values": [
        {"uuid": "erIavvd3TG6naKWwGag2TQ", "id": 1, "name": "Monitoring"}, 
        {"uuid": "OtrL3B00RsuFpcOVCAQ08Q", "id": 2, "name": "Recette"}, 
        {"uuid": "fN5Y2U2HRsK1HKw1X_H77A", "id": 3, "name": "Intégration"}, 
        {"uuid": "ARezM52EQhGoxHoFJrm1oA", "id": 4, "name": "PréProduction"}, 
        {"uuid": "PDIJyZMaSQOtFB2LEz9kwA", "id": 5, "name": "Production"}
      ]
    },
    {
      "name": "roles",
      "values": [
        {"id": 1, "name": "data_hot"}, 
        {"id": 2, "name": "data_warm"}, 
        {"id": 3, "name": "data_cold"}, 
        {"id": 4, "name": "data_frozen"}
      ]
    },
    {
      "name": "jvm",
      "url": {
        "%context%": true,
        "%timefield%": "@timestamp",
        "index": ".monitoring-es-*",
        "query": {
          "bool": {
            "filter": [
              {
                "term": {
                  "event.dataset": "elasticsearch.node.stats"
                }
              }
            ]
          }
        }, 
        "body": {
          "aggs": {
            "cluster": {
              "terms": {
                "field": "cluster_uuid",
                "size": 10
              },
              "aggs": {
                "role": {
                  "terms": { 
                    "field": "elasticsearch.node.roles",
                    "include": "data_.*",
                    "exclude": "data_content",
                    "min_doc_count": 0
                  },
                  "aggs": {
                    "node": {
                      "terms": {
                        "field": "elasticsearch.node.name",
                        "size": 10
                      },
                      "aggs": {
                        "max_jvm": {
                          "max": {
                            "field": "elasticsearch.node.stats.jvm.mem.heap.max.bytes"
                          }
                        }
                      }
                    },
                    "sum_jvm": {
                      "sum_bucket": {
                        "buckets_path": "node>max_jvm" 
                      }
                    }
                  }
                }
              }
            }
          },
          "size": 0
        }
      }
      "format": {"property": "aggregations.cluster.buckets"}
      "transform": [
        {
          "type": "lookup",
          "from": "clusters",
          "key": "uuid",
          "fields": ["key"],
          "values": ["id", "name"],
          "as": ["cluster_id", "cluster_name"]
        },
        {
          "type": "flatten", 
          "fields": ["role.buckets"],
          "as" : ["role"]
        },
        {
          "type": "formula", 
          "as": "total_jvm", 
          "expr": "ceil(datum.role.sum_jvm.value / 1024 / 1024 / 1024)"
        },
        {
          "type": "formula", 
          "as": "role", 
          "expr": "datum.role.key"
        },
        {
          "type": "lookup",
          "from": "roles",
          "key": "name",
          "fields": ["role"],
          "values": ["id"],
          "as": ["role_id"]
        },
        {
          "type": "identifier",
          "as": "id"
        }
      ]
    }
  ],
  "scales": [
    {
      "name": "yscale",
      "type": "band",
      "domain": {"data": "jvm", "field": "cluster_name", "sort": {"op": "median", "field": "cluster_id", "order": "descending"}},
      "range": "height",
      "padding": 0.2
    },
    {
      "name": "xscale",
      "type": "linear",
      "domain": {"data": "jvm", "field": "total_jvm"},
      "range": "width",
      "zero": true,
      "nice": true
    },
    {
      "name": "color",
      "type": "linear",
      "domain": {"data": "jvm", "field": "role_id", "sort": {"op": "median", "field": "role_id", "order": "ascending"}},
      "range": ["#c0392b", "#f1c40f", "#27ae60", "#3498db"]
    },
    {
      "name": "scale_legend_values",
      "type": "ordinal",
      "domain": {"data": "jvm", "field": "role_id"},
      "range": {"data": "jvm", "field": "role"}
    }
  ],
   "axes": [
    {"orient": "left", "scale": "yscale", "tickSize": 0, "labelPadding": 25, "zindex": 1, "labelColor": "black"},
    {"orient": "bottom", "scale": "xscale", "labelColor": "black"}
  ],
  "marks": [
    {
      "type": "group",
      "from": {
        "facet": {
          "data": "jvm",
          "name": "facet",
          "groupby": "cluster_name"
        }
      },
      "encode": {
        "enter": {
          "y": {"scale": "yscale", "field": "cluster_name"}
        }
      },
      "signals": [
        {"name": "height", "update": "bandwidth('yscale')"}
      ],
      "scales": [
        {
          "name": "role",
          "type": "band",
          "range": "height",
          "domain": {"data": "facet", "field": "role_id", "sort": true}
        }
      ],
      "marks": [
        {
          "name": "bars",
          "from": {"data": "facet"},
          "type": "rect",
          "encode": {
            "enter": {
              "y": {"scale": "role", "field": "role_id"},
              "height": {"scale": "role", "band": 1},
              "x": {"scale": "xscale", "field": "total_jvm"},
              "x2": {"scale": "xscale", "value": 0},
              "fill": {"scale": "color", "field": "role_id"}
            }
          }
        },
        {
          "type": "text",
          "from": {"data": "bars"},
          "encode": {
            "enter": {
              "x": {"field": "x2", "offset": 8},
              "y": {"field": "y", "offset": {"field": "height", "mult": 0.55}},
              "fill": {"value": "black"},
              "align": {"value": "center"},
              "baseline": {"value": "middle"},
              "text": {"field": "datum.total_jvm"}
            }
          }
        }
      ]
    }
  ],
  "legends": [
    {
      "type": "symbol",
      "symbolType": "square",
      "fill": "color",
      "titleColor": "black",
      "labelColor": "black",
      "title": "Roles",
      "orient": "bottom",
      "direction": "horizontal",
      "values" : [ 1, 2, 3, 4],
      "encode": {
        "labels": {
          "update": {
            "text": {
              "signal": "scale('scale_legend_values', datum.value)"
            }
          }
        }
      }
    }
  ]
}
