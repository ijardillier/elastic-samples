// JSON.stringify(VEGA_DEBUG.vega_spec)  // <-- if you use Vega
// JSON.stringify(VEGA_DEBUG.vegalite_spec)  // <-- if you use Vega-Lite

//VEGA_DEBUG.view.getState()
//VEGA_DEBUG.view.signal('period_max')
//VEGA_DEBUG.view.data('nodes_jvm')
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "title": {
    "text": "Shards stats by cluster and role", 
    "color": "black"
  },
  "description": "Information about shards on clusters",
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
      "name": "nodes",
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
                      }
                    }
                  }
                }
              }
            }
          },
          "size": 0
        }
      },
      "format": {"property": "aggregations.cluster.buckets"},
      "transform": [
        {
          "type": "flatten", 
          "fields": ["role.buckets"],
          "as" : ["role"]
        },
        {
          "type": "flatten", 
          "fields": ["role.node.buckets"],
          "as" : ["node"]
        },
        {
          "type": "formula", 
          "as": "role", 
          "expr": "datum.role.key"
        },
        {
          "type": "formula", 
          "as": "node", 
          "expr": "datum.node.key"
        },
        {
          "type": "formula", 
          "as": "node_key", 
          "expr": "datum.key + '-' + datum.node"
        }
      ]
    },
    {
      "name": "shards",
      "url": {
        "%context%": true,
        "%timefield%": "@timestamp",
        "index": ".monitoring-es-*",
        "query": {
          "bool": {
            "filter": [
              {
                "term": {
                  "event.dataset": "elasticsearch.shard"
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
                "node": {
                  "terms": {
                    "field": "elasticsearch.node.name",
                    "size": 10
                  },
                  "aggs": {
                    "index": {
                      "terms": {
                        "field": "elasticsearch.index.name",
                        "size": 10000
                      },
                      "aggs": {
                        "shard": {
                          "terms": {
                            "field": "elasticsearch.shard.primary"
                          },
                          "aggs": {
                            "shard_number": {
                              "max": {
                                "field": "elasticsearch.shard.number"
                              }
                            },
                            "shard_count_per_shard_type": {
                              "bucket_script": {
                                "buckets_path": {
                                  "shardNumber": "shard_number"
                                },
                                "script": "params.shardNumber + 1"
                              }
                            }
                          }
                        },
                        "shard_count_per_index": {
                          "sum_bucket": {
                            "buckets_path": "shard>shard_count_per_shard_type" 
                          }
                        }
                      }
                    },
                    "shard_count_per_node": {
                      "sum_bucket": {
                        "buckets_path": "index>shard_count_per_index" 
                      }
                    }
                  }
                }
              }
            }
          },
          "size": 0
        }
      },
      "format": {"property": "aggregations.cluster.buckets"},
      "transform": [
        {
          "type": "flatten", 
          "fields": ["node.buckets"],
          "as" : ["node"]
        },
        {
          "type": "formula", 
          "as": "shard_count", 
          "expr": "datum.node.shard_count_per_node.value"
        },
        {
          "type": "formula", 
          "as": "node", 
          "expr": "datum.node.key"
        },
        {
          "type": "formula", 
          "as": "node_key", 
          "expr": "datum.key + '-' + datum.node"
        },
        {
          "type": "lookup",
          "from": "nodes",
          "key": "node_key",
          "fields": ["node_key"],
          "values": ["role"],
          "as": ["role"]
        },
        {
          "type": "aggregate",
          "fields": ["shard_count"],
          "ops": ["sum"],
          "as": ["total_shard_count"],
          "groupby": ["key", "role"]
        },
        {
          "type": "formula", 
          "as": "role_key", 
          "expr": "datum.key + '-' + datum.role"
        }
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
      },
      "format": {"property": "aggregations.cluster.buckets"},
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
        },
        {
          "type": "formula", 
          "as": "min_shards", 
          "expr": "datum.total_jvm * 10"
        },
        {
          "type": "formula", 
          "as": "max_shards", 
          "expr": "datum.total_jvm * 20"
        },
        {
          "type": "formula", 
          "as": "role_key", 
          "expr": "datum.key + '-' + datum.role"
        },
        {
          "type": "lookup",
          "from": "shards",
          "key": "role_key",
          "fields": ["role_key"],
          "values": ["total_shard_count"],
          "as": ["total_shard_count"]
        },
        {
          "type": "formula", 
          "as": "max_x", 
          "expr": "max(datum.total_shard_count, datum.max_shards)"
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
      "type": "sqrt",
      "domain": {"data": "jvm", "field": "max_x"},
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
          "name": "bars-total",
          "from": {"data": "facet"},
          "type": "rule",
          "encode": {
            "enter": {
              "y": {"scale": "role", "field": "role_id"},
              "y2": {"scale": "role", "field": "role_id"},
              "height": {"scale": "role", "band": 0.05},
              "x": {"scale": "xscale", "value": 0},
              "x2": {"scale": "xscale", "field": "max_x"},
              "stroke": {"value": "black"},
              "strokeWidth": {"value": 0.5},
              "strokeDash": {"value": [2, 2]}
            }
          }
        },
        {
          "name": "bars",
          "from": {"data": "facet"},
          "type": "rect",
          "encode": {
            "enter": {
              "y": {"scale": "role", "field": "role_id"},
              "height": {"scale": "role", "band": 0.05},
              "x": {"scale": "xscale", "field": "max_shards"},
              "x2": {"scale": "xscale", "field": "min_shards"},
              "fill": {"scale": "color", "field": "role_id"}
            }
          }
        },
        {
          "type": "text",
          "from": {"data": "bars"},
          "encode": {
            "enter": {
              "x": {"field": "x", "offset": -6},
              "y": {"field": "y", "offset": {"field": "height", "mult": 0.55}},
              "dy": {"value": 12}
              "fill": {"value": "black"}
              "align": {"value": "center"},
              "baseline": {"value": "middle"},
              "text": {"field": "datum.min_shards"}
            }
          }
        },
        {
          "type": "text",
          "from": {"data": "bars"},
          "encode": {
            "enter": {
              "x": {"field": "x2", "offset": 6},
              "y": {"field": "y", "offset": {"field": "height", "mult": 0.55}},
              "dy": {"value": 12},
              "fill": {"value": "black"},
              "align": {"value": "center"},
              "baseline": {"value": "middle"},
              "text": {"field": "datum.max_shards"}
            }
          }
        },
        {
          "name": "actual",
          "type": "symbol",
          "from": {"data": "facet"},
          "encode": {
            "enter": {
              "y": {"scale": "role", "field": "role_id"},              
              "x": {"scale": "xscale", "field": "total_shard_count"},
              "height": {"scale": "role", "band": 0.05},
              "stroke": {"scale": "color", "field": "role_id"},
              "shape": {"value": "stroke"},
              "opacity": {"value": 1}    
              "strokeWidth": {"value": 3},
              "angle": {"value": 90},
              "size": {"value": 150},   
              "tooltip": {
                "signal": "{title: datum.cluster_name + ' (' + datum.role + ')', 'Shards count': datum.total_shard_count, 'Shards min': datum.min_shards, 'Shards max': datum.max_shards}"
              }
            },
            "hover": {                         
              "opacity": {"value": 0.5}                              
            },
            "update": {                         
              "opacity": {"value": 1}                              
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
