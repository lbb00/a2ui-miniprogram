// A2UI official test cases suite (all 36 suites, 43 total scenarios)
module.exports = [
  {
    "file": "00_complex-layout.json",
    "name": "Complex Layout",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-complex-layout",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-complex-layout",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "header",
                "form_row",
                "footer"
              ],
              "justify": "spaceBetween",
              "align": "stretch"
            },
            {
              "id": "header",
              "component": "Text",
              "text": "# User Profile Form"
            },
            {
              "id": "form_row",
              "component": "Row",
              "children": [
                "first_name",
                "last_name"
              ],
              "justify": "start",
              "align": "start"
            },
            {
              "id": "first_name",
              "component": "TextField",
              "label": "First Name",
              "value": {
                "@path": "/firstName"
              },
              "weight": 1
            },
            {
              "id": "last_name",
              "component": "TextField",
              "label": "Last Name",
              "value": {
                "@path": "/lastName"
              },
              "weight": 1
            },
            {
              "id": "footer",
              "component": "Text",
              "text": "Please fill out all fields.",
              "variant": "caption"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "00_formatted-text.json",
    "name": "Formatted Text",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-formatted-text",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-formatted-text",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "input_field",
                "result_label",
                "result_text"
              ],
              "justify": "start",
              "align": "stretch"
            },
            {
              "id": "input_field",
              "component": "TextField",
              "label": "Type something:",
              "value": {
                "@path": "/inputValue"
              },
              "variant": "shortText"
            },
            {
              "id": "result_label",
              "component": "Text",
              "text": "Formatted output:",
              "variant": "caption"
            },
            {
              "id": "result_text",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "You typed: ${/inputValue}"
                }
              },
              "variant": "body"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "00_incremental.json",
    "name": "Incremental",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-incremental",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-incremental",
          "path": "/",
          "value": {
            "restaurants": [
              {
                "title": "The Golden Fork",
                "subtitle": "Fine Dining & Spirits",
                "address": "123 Gastronomy Lane"
              },
              {
                "title": "Ocean's Bounty",
                "subtitle": "Fresh Daily Seafood",
                "address": "456 Shoreline Dr"
              },
              {
                "title": "Pizzeria Roma",
                "subtitle": "Authentic Wood-Fired Pizza",
                "address": "789 Napoli Way"
              }
            ]
          }
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-incremental",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": {
                "path": "/restaurants",
                "componentId": "restaurant_card"
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-incremental",
          "components": [
            {
              "id": "restaurant_card",
              "component": "Column",
              "children": [
                "rc_title",
                "rc_subtitle",
                "rc_address"
              ]
            },
            {
              "id": "rc_title",
              "component": "Text",
              "text": {
                "@path": "title"
              }
            },
            {
              "id": "rc_subtitle",
              "component": "Text",
              "text": {
                "@path": "subtitle"
              }
            },
            {
              "id": "rc_address",
              "component": "Text",
              "text": {
                "@path": "address"
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-incremental",
          "path": "/restaurants/3",
          "value": {
            "title": "Spice Route",
            "subtitle": "Exotic Flavors from the East",
            "address": "101 Silk Road St"
          }
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-incremental",
          "components": [
            {
              "id": "restaurant_card",
              "component": "Column",
              "children": [
                "rc_title",
                "rc_subtitle",
                "rc_address",
                "rc_button"
              ]
            },
            {
              "id": "rc_button",
              "component": "Button",
              "child": "rc_button_label",
              "action": {
                "event": {
                  "name": "book_now",
                  "context": {
                    "restaurantName": {
                      "@path": "title"
                    }
                  }
                }
              }
            },
            {
              "id": "rc_button_label",
              "component": "Text",
              "text": "Book now"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "00_interactive-button.json",
    "name": "Interactive Button",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-interactive-button",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-interactive-button",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "title",
                "action_button"
              ],
              "justify": "center",
              "align": "center"
            },
            {
              "id": "title",
              "component": "Text",
              "text": "Click the button below",
              "variant": "body"
            },
            {
              "id": "action_button",
              "component": "Button",
              "child": "button_label",
              "variant": "primary",
              "action": {
                "event": {
                  "name": "button_clicked",
                  "context": {}
                }
              }
            },
            {
              "id": "button_label",
              "component": "Text",
              "text": "Click Me"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "00_row-layout.json",
    "name": "Row Layout",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-row-layout",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-row-layout",
          "components": [
            {
              "id": "root",
              "component": "Row",
              "children": [
                "left_text",
                "right_text"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "left_text",
              "component": "Text",
              "text": "Left Content",
              "variant": "body"
            },
            {
              "id": "right_text",
              "component": "Text",
              "text": "Right Content",
              "variant": "caption"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "00_simple-login-form.json",
    "name": "Simple Login Form",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-simple-login-form",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-simple-login-form",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "form_title",
                "username_field",
                "password_field",
                "submit_button"
              ],
              "justify": "start",
              "align": "stretch"
            },
            {
              "id": "form_title",
              "component": "Text",
              "text": "## Login"
            },
            {
              "id": "username_field",
              "component": "TextField",
              "label": "Username",
              "value": {
                "@path": "/username"
              },
              "variant": "shortText"
            },
            {
              "id": "password_field",
              "component": "TextField",
              "label": "Password",
              "value": {
                "@path": "/password"
              },
              "variant": "obscured"
            },
            {
              "id": "submit_button",
              "component": "Button",
              "child": "submit_label",
              "variant": "primary",
              "action": {
                "event": {
                  "name": "login_submitted",
                  "context": {
                    "user": {
                      "@path": "/username"
                    },
                    "pass": {
                      "@path": "/password"
                    }
                  }
                }
              }
            },
            {
              "id": "submit_label",
              "component": "Text",
              "text": "Sign In"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "00_simple-text.json",
    "name": "Simple Text",
    "description": "Simple example demonstrating basic catalog components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-simple-text",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-simple-text",
          "components": [
            {
              "id": "root",
              "component": "Text",
              "text": "# Hello, Minimal Catalog!"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "01_flight-status.json",
    "name": "Flight Status",
    "description": "Example of flight status demonstrating date formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-flight-status",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-flight-status",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header_row",
                "route_row",
                "divider",
                "times_row"
              ],
              "align": "stretch"
            },
            {
              "id": "header_row",
              "component": "Row",
              "children": [
                "header_left",
                "date"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "header_left",
              "component": "Row",
              "children": [
                "flight_indicator",
                "flight_number"
              ],
              "align": "center"
            },
            {
              "id": "flight_indicator",
              "component": "Icon",
              "name": "send"
            },
            {
              "id": "flight_number",
              "component": "Text",
              "text": {
                "@path": "/flightNumber"
              }
            },
            {
              "id": "date",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/date"
                  },
                  "format": "E, MMM d"
                }
              },
              "variant": "caption"
            },
            {
              "id": "route_row",
              "component": "Row",
              "children": [
                "origin",
                "arrow",
                "destination"
              ],
              "align": "center"
            },
            {
              "id": "origin",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "## ${/origin}"
                }
              }
            },
            {
              "id": "arrow",
              "component": "Text",
              "text": "## →"
            },
            {
              "id": "destination",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "## ${/destination}"
                }
              }
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "times_row",
              "component": "Row",
              "children": [
                "departure_col",
                "status_col",
                "arrival_col"
              ],
              "justify": "spaceBetween"
            },
            {
              "id": "departure_col",
              "component": "Column",
              "children": [
                "departure_label",
                "departure_time"
              ],
              "align": "start"
            },
            {
              "id": "departure_label",
              "component": "Text",
              "text": "Departs",
              "variant": "caption"
            },
            {
              "id": "departure_time",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/departureTime"
                  },
                  "format": "h:mm a"
                }
              }
            },
            {
              "id": "status_col",
              "component": "Column",
              "children": [
                "status_label",
                "status_value"
              ],
              "align": "center"
            },
            {
              "id": "status_label",
              "component": "Text",
              "text": "Status",
              "variant": "caption"
            },
            {
              "id": "status_value",
              "component": "Text",
              "text": {
                "@path": "/status"
              },
              "variant": "body"
            },
            {
              "id": "arrival_col",
              "component": "Column",
              "children": [
                "arrival_label",
                "arrival_time"
              ],
              "align": "end"
            },
            {
              "id": "arrival_label",
              "component": "Text",
              "text": "Arrives",
              "variant": "caption"
            },
            {
              "id": "arrival_time",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/arrivalTime"
                  },
                  "format": "h:mm a"
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-flight-status",
          "value": {
            "flightNumber": "OS 87",
            "date": "2025-12-15",
            "origin": "Vienna",
            "destination": "New York",
            "departureTime": "2025-12-15T10:15:00Z",
            "status": "On Time",
            "arrivalTime": "2025-12-15T14:30:00Z"
          }
        }
      }
    ]
  },
  {
    "file": "02_email-compose.json",
    "name": "Email Compose",
    "description": "Example of email compose",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-email-compose",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-email-compose",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "from_row",
                "to_row",
                "subject_row",
                "divider",
                "message",
                "actions"
              ]
            },
            {
              "id": "from_row",
              "component": "Row",
              "children": [
                "from_label",
                "from_value"
              ],
              "align": "center"
            },
            {
              "id": "from_label",
              "component": "Text",
              "text": "FROM",
              "variant": "caption"
            },
            {
              "id": "from_value",
              "component": "Text",
              "text": {
                "@path": "/from"
              },
              "variant": "body"
            },
            {
              "id": "to_row",
              "component": "Row",
              "children": [
                "to_label",
                "to_value"
              ],
              "align": "center"
            },
            {
              "id": "to_label",
              "component": "Text",
              "text": "TO",
              "variant": "caption"
            },
            {
              "id": "to_value",
              "component": "Text",
              "text": {
                "@path": "/to"
              },
              "variant": "body"
            },
            {
              "id": "subject_row",
              "component": "Row",
              "children": [
                "subject_label",
                "subject_value"
              ],
              "align": "center"
            },
            {
              "id": "subject_label",
              "component": "Text",
              "text": "SUBJECT",
              "variant": "caption"
            },
            {
              "id": "subject_value",
              "component": "Text",
              "text": {
                "@path": "/subject"
              },
              "variant": "body"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "message",
              "component": "Column",
              "children": [
                "greeting",
                "body_text",
                "closing",
                "signature"
              ]
            },
            {
              "id": "greeting",
              "component": "Text",
              "text": {
                "@path": "/greeting"
              },
              "variant": "body"
            },
            {
              "id": "body_text",
              "component": "Text",
              "text": {
                "@path": "/body"
              },
              "variant": "body"
            },
            {
              "id": "closing",
              "component": "Text",
              "text": {
                "@path": "/closing"
              },
              "variant": "body"
            },
            {
              "id": "signature",
              "component": "Text",
              "text": {
                "@path": "/signature"
              },
              "variant": "body"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "send_btn",
                "discard_btn"
              ]
            },
            {
              "id": "send_btn_text",
              "component": "Text",
              "text": "Send email"
            },
            {
              "id": "send_btn",
              "component": "Button",
              "child": "send_btn_text",
              "action": {
                "event": {
                  "name": "send",
                  "context": {}
                }
              }
            },
            {
              "id": "discard_btn_text",
              "component": "Text",
              "text": "Discard"
            },
            {
              "id": "discard_btn",
              "component": "Button",
              "child": "discard_btn_text",
              "action": {
                "event": {
                  "name": "discard",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-email-compose",
          "value": {
            "from": "alex@acme.com",
            "to": "jordan@acme.com",
            "subject": "Q4 Revenue Forecast",
            "greeting": "Hi Jordan,",
            "body": "Following up on our call. Please review the attached Q4 forecast and let me know if you have questions before the board meeting.",
            "closing": "Best,",
            "signature": "Alex"
          }
        }
      }
    ]
  },
  {
    "file": "03_calendar-day.json",
    "name": "Calendar Day",
    "description": "Example of calendar day demonstrating dynamic templating, relative paths, and date formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-calendar-day",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-calendar-day",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header_row",
                "divider",
                "actions"
              ]
            },
            {
              "id": "header_row",
              "component": "Row",
              "children": [
                "date_col",
                "events_col"
              ]
            },
            {
              "id": "date_col",
              "component": "Column",
              "children": [
                "day_name",
                "day_number"
              ],
              "align": "start"
            },
            {
              "id": "day_name",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/date"
                  },
                  "format": "EEEE"
                }
              },
              "variant": "caption"
            },
            {
              "id": "day_number",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/date"
                  },
                  "format": "d"
                }
              }
            },
            {
              "id": "events_col",
              "component": "Column",
              "children": {
                "path": "/events",
                "componentId": "event_template"
              }
            },
            {
              "id": "event_template",
              "component": "Column",
              "children": [
                "event_title",
                "event_time"
              ]
            },
            {
              "id": "event_title",
              "component": "Text",
              "text": {
                "@path": "title"
              },
              "variant": "body"
            },
            {
              "id": "event_time",
              "component": "Text",
              "text": {
                "@path": "time"
              },
              "variant": "caption"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "add_btn",
                "discard_btn"
              ]
            },
            {
              "id": "add_btn_text",
              "component": "Text",
              "text": "Add to calendar"
            },
            {
              "id": "add_btn",
              "component": "Button",
              "child": "add_btn_text",
              "action": {
                "event": {
                  "name": "add",
                  "context": {}
                }
              }
            },
            {
              "id": "discard_btn_text",
              "component": "Text",
              "text": "Discard"
            },
            {
              "id": "discard_btn",
              "component": "Button",
              "child": "discard_btn_text",
              "action": {
                "event": {
                  "name": "discard",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-calendar-day",
          "value": {
            "date": "2025-12-28",
            "events": [
              {
                "title": "Lunch",
                "time": "12:00 - 12:45 PM"
              },
              {
                "title": "Q1 roadmap review",
                "time": "1:00 - 2:00 PM"
              },
              {
                "title": "Team standup",
                "time": "3:30 - 4:00 PM"
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "04_weather-current.json",
    "name": "Weather Current",
    "description": "Example of weather current demonstrating templating and string formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-weather-current",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-weather-current",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "temp_row",
                "location",
                "description",
                "forecast_row"
              ],
              "align": "center"
            },
            {
              "id": "temp_row",
              "component": "Row",
              "children": [
                "temp_high",
                "temp_low"
              ],
              "align": "start"
            },
            {
              "id": "temp_high",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "# ${/tempHigh}°"
                }
              }
            },
            {
              "id": "temp_low",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "## ${/tempLow}°"
                }
              }
            },
            {
              "id": "location",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "### ${/location}"
                }
              }
            },
            {
              "id": "description",
              "component": "Text",
              "text": {
                "@path": "/description"
              },
              "variant": "caption"
            },
            {
              "id": "forecast_row",
              "component": "Row",
              "children": {
                "path": "/forecast",
                "componentId": "forecast_day_template"
              },
              "justify": "spaceAround"
            },
            {
              "id": "forecast_day_template",
              "component": "Column",
              "children": [
                "day_name",
                "day_icon",
                "day_temp"
              ],
              "align": "center"
            },
            {
              "id": "day_name",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "date"
                  },
                  "format": "E"
                }
              },
              "variant": "caption"
            },
            {
              "id": "day_icon",
              "component": "Text",
              "text": {
                "@path": "icon"
              }
            },
            {
              "id": "day_temp",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${temp}°"
                }
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-weather-current",
          "value": {
            "tempHigh": 72,
            "tempLow": 58,
            "location": "Austin, TX",
            "description": "Clear skies with light breeze",
            "forecast": [
              {
                "date": "2025-12-16",
                "icon": "☀️",
                "temp": 74
              },
              {
                "date": "2025-12-17",
                "icon": "☀️",
                "temp": 76
              },
              {
                "date": "2025-12-18",
                "icon": "⛅",
                "temp": 71
              },
              {
                "date": "2025-12-19",
                "icon": "☀️",
                "temp": 73
              },
              {
                "date": "2025-12-20",
                "icon": "☀️",
                "temp": 75
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "05_product-card.json",
    "name": "Product Card",
    "description": "Example of product card demonstrating currency formatting and pluralization.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-product-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-product-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "image",
                "details"
              ]
            },
            {
              "id": "image",
              "component": "Image",
              "url": {
                "@path": "/imageUrl"
              },
              "fit": "cover"
            },
            {
              "id": "details",
              "component": "Column",
              "children": [
                "name",
                "rating_row",
                "price_row",
                "actions"
              ]
            },
            {
              "id": "name",
              "component": "Text",
              "text": {
                "@path": "/name"
              }
            },
            {
              "id": "rating_row",
              "component": "Row",
              "children": [
                "stars",
                "reviews"
              ],
              "align": "center"
            },
            {
              "id": "stars",
              "component": "Text",
              "text": {
                "@path": "/stars"
              },
              "variant": "body"
            },
            {
              "id": "reviews",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "(${formatNumber(value: ${/reviewCount})} ${pluralize(value: ${/reviewCount}, one: 'review', other: 'reviews')})"
                }
              },
              "variant": "caption"
            },
            {
              "id": "price_row",
              "component": "Row",
              "children": [
                "price",
                "original_price"
              ],
              "align": "start"
            },
            {
              "id": "price",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/price"
                  },
                  "currency": "USD"
                }
              }
            },
            {
              "id": "original_price",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/originalPrice"
                  },
                  "currency": "USD"
                }
              },
              "variant": "caption"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "add_cart_btn"
              ]
            },
            {
              "id": "add_cart_btn_text",
              "component": "Text",
              "text": "Add to Cart"
            },
            {
              "id": "add_cart_btn",
              "component": "Button",
              "child": "add_cart_btn_text",
              "variant": "primary",
              "action": {
                "event": {
                  "name": "addToCart",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-product-card",
          "value": {
            "imageUrl": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop",
            "name": "Wireless Headphones Pro",
            "stars": "★★★★★",
            "reviewCount": 2847,
            "price": 199.99,
            "originalPrice": 249.99
          }
        }
      }
    ]
  },
  {
    "file": "06_music-player.json",
    "name": "Music Player",
    "description": "Example of music player",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-music-player",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-music-player",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "album_art",
                "track_info",
                "progress",
                "time_row",
                "controls"
              ],
              "align": "center"
            },
            {
              "id": "album_art",
              "component": "Image",
              "url": {
                "@path": "/albumArt"
              },
              "fit": "cover"
            },
            {
              "id": "track_info",
              "component": "Column",
              "children": [
                "song_title",
                "artist"
              ],
              "align": "center"
            },
            {
              "id": "song_title",
              "component": "Text",
              "text": {
                "@path": "/title"
              }
            },
            {
              "id": "artist",
              "component": "Text",
              "text": {
                "@path": "/artist"
              },
              "variant": "caption"
            },
            {
              "id": "progress",
              "component": "Slider",
              "value": {
                "@path": "/progress"
              },
              "max": 1
            },
            {
              "id": "time_row",
              "component": "Row",
              "children": [
                "current_time",
                "total_time"
              ],
              "justify": "spaceBetween"
            },
            {
              "id": "current_time",
              "component": "Text",
              "text": {
                "@path": "/currentTime"
              },
              "variant": "caption"
            },
            {
              "id": "total_time",
              "component": "Text",
              "text": {
                "@path": "/totalTime"
              },
              "variant": "caption"
            },
            {
              "id": "controls",
              "component": "Row",
              "children": [
                "prev_btn",
                "play_btn",
                "next_btn"
              ],
              "justify": "center"
            },
            {
              "id": "prev_btn_icon",
              "component": "Icon",
              "name": "skipPrevious"
            },
            {
              "id": "prev_btn",
              "component": "Button",
              "child": "prev_btn_icon",
              "action": {
                "event": {
                  "name": "previous",
                  "context": {}
                }
              }
            },
            {
              "id": "play_btn_icon",
              "component": "Icon",
              "name": {
                "@path": "/playIcon"
              }
            },
            {
              "id": "play_btn",
              "component": "Button",
              "child": "play_btn_icon",
              "action": {
                "event": {
                  "name": "playPause",
                  "context": {}
                }
              }
            },
            {
              "id": "next_btn_icon",
              "component": "Icon",
              "name": "skipNext"
            },
            {
              "id": "next_btn",
              "component": "Button",
              "child": "next_btn_icon",
              "action": {
                "event": {
                  "name": "next",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-music-player",
          "value": {
            "albumArt": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
            "title": "Blinding Lights",
            "artist": "The Weeknd",
            "album": "After Hours",
            "progress": 0.45,
            "currentTime": "1:48",
            "totalTime": "4:22",
            "playIcon": "pause"
          }
        }
      }
    ]
  },
  {
    "file": "07_task-card.json",
    "name": "Task Card",
    "description": "Example of task card demonstrating CheckBox and DateTimeInput.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-task-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-task-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_row"
            },
            {
              "id": "main_row",
              "component": "Row",
              "children": [
                "status_checkbox",
                "content",
                "priority"
              ],
              "align": "start"
            },
            {
              "id": "status_checkbox",
              "component": "CheckBox",
              "label": "",
              "value": {
                "@path": "/completed"
              }
            },
            {
              "id": "content",
              "component": "Column",
              "children": [
                "title",
                "description",
                "meta_row"
              ]
            },
            {
              "id": "title",
              "component": "Text",
              "text": {
                "@path": "/title"
              }
            },
            {
              "id": "description",
              "component": "Text",
              "text": {
                "@path": "/description"
              },
              "variant": "body"
            },
            {
              "id": "meta_row",
              "component": "Row",
              "children": [
                "due_date_input",
                "project"
              ],
              "align": "center"
            },
            {
              "id": "due_date_input",
              "component": "DateTimeInput",
              "label": "Due",
              "value": {
                "@path": "/dueDate"
              },
              "enableDate": true,
              "enableTime": true
            },
            {
              "id": "project",
              "component": "Text",
              "text": {
                "@path": "/project"
              },
              "variant": "caption"
            },
            {
              "id": "priority",
              "component": "Icon",
              "name": {
                "@path": "/priorityIcon"
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-task-card",
          "value": {
            "completed": false,
            "title": "Review pull request",
            "description": "Review and approve the authentication module changes.",
            "dueDate": "2025-12-15T17:00:00Z",
            "project": "Backend",
            "priorityIcon": "warning"
          }
        }
      }
    ]
  },
  {
    "file": "08_user-profile.json",
    "name": "User Profile",
    "description": "Example of user profile demonstrating number formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-user-profile",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-user-profile",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "info",
                "bio",
                "stats_row",
                "follow_btn"
              ],
              "align": "center"
            },
            {
              "id": "header",
              "component": "Image",
              "url": {
                "@path": "/avatar"
              },
              "fit": "cover",
              "variant": "avatar"
            },
            {
              "id": "info",
              "component": "Column",
              "children": [
                "name",
                "username"
              ],
              "align": "center"
            },
            {
              "id": "name",
              "component": "Text",
              "text": {
                "@path": "/name"
              }
            },
            {
              "id": "username",
              "component": "Text",
              "text": {
                "@path": "/username"
              },
              "variant": "caption"
            },
            {
              "id": "bio",
              "component": "Text",
              "text": {
                "@path": "/bio"
              },
              "variant": "body"
            },
            {
              "id": "stats_row",
              "component": "Row",
              "children": [
                "followers_col",
                "following_col",
                "posts_col"
              ],
              "justify": "spaceAround"
            },
            {
              "id": "followers_col",
              "component": "Column",
              "children": [
                "followers_count",
                "followers_label"
              ],
              "align": "center"
            },
            {
              "id": "followers_count",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "/followers"
                  }
                }
              }
            },
            {
              "id": "followers_label",
              "component": "Text",
              "text": "Followers",
              "variant": "caption"
            },
            {
              "id": "following_col",
              "component": "Column",
              "children": [
                "following_count",
                "following_label"
              ],
              "align": "center"
            },
            {
              "id": "following_count",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "/following"
                  }
                }
              }
            },
            {
              "id": "following_label",
              "component": "Text",
              "text": "Following",
              "variant": "caption"
            },
            {
              "id": "posts_col",
              "component": "Column",
              "children": [
                "posts_count",
                "posts_label"
              ],
              "align": "center"
            },
            {
              "id": "posts_count",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "/posts"
                  }
                }
              }
            },
            {
              "id": "posts_label",
              "component": "Text",
              "text": "Posts",
              "variant": "caption"
            },
            {
              "id": "follow_btn_text",
              "component": "Text",
              "text": {
                "@path": "/followText"
              }
            },
            {
              "id": "follow_btn",
              "component": "Button",
              "child": "follow_btn_text",
              "action": {
                "event": {
                  "name": "follow",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-user-profile",
          "value": {
            "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
            "name": "Sarah Chen",
            "username": "@sarahchen",
            "bio": "Product Designer at Tech Co. Creating delightful experiences.",
            "followers": 12400,
            "following": 892,
            "posts": 347,
            "followText": "Follow"
          }
        }
      }
    ]
  },
  {
    "file": "09_login-form.json",
    "name": "Login Form with Validation",
    "description": "Example of login form demonstrating validation checks and logic.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-login-form",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-login-form",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "email_field",
                "password_field",
                "login_btn",
                "divider",
                "signup_text"
              ]
            },
            {
              "id": "header",
              "component": "Column",
              "children": [
                "title",
                "subtitle"
              ],
              "align": "center"
            },
            {
              "id": "title",
              "component": "Text",
              "text": "## Welcome back"
            },
            {
              "id": "subtitle",
              "component": "Text",
              "text": "Sign in to your account",
              "variant": "caption"
            },
            {
              "id": "email_field",
              "component": "TextField",
              "value": {
                "@path": "/email"
              },
              "label": "Email",
              "checks": [
                {
                  "condition": {
                    "@call": "required",
                    "args": {
                      "value": {
                        "@path": "/email"
                      }
                    }
                  },
                  "message": "Email is required"
                },
                {
                  "condition": {
                    "@call": "email",
                    "args": {
                      "value": {
                        "@path": "/email"
                      }
                    }
                  },
                  "message": "Please enter a valid email address"
                }
              ]
            },
            {
              "id": "password_field",
              "component": "TextField",
              "value": {
                "@path": "/password"
              },
              "label": "Password",
              "variant": "obscured",
              "checks": [
                {
                  "condition": {
                    "@call": "required",
                    "args": {
                      "value": {
                        "@path": "/password"
                      }
                    }
                  },
                  "message": "Password is required"
                },
                {
                  "condition": {
                    "@call": "length",
                    "args": {
                      "value": {
                        "@path": "/password"
                      },
                      "min": 8
                    }
                  },
                  "message": "Password must be at least 8 characters long"
                }
              ]
            },
            {
              "id": "login_btn_text",
              "component": "Text",
              "text": "Sign in"
            },
            {
              "id": "login_btn",
              "component": "Button",
              "child": "login_btn_text",
              "checks": [
                {
                  "condition": {
                    "@call": "and",
                    "args": {
                      "values": [
                        {
                          "@call": "email",
                          "args": {
                            "value": {
                              "@path": "/email"
                            }
                          }
                        },
                        {
                          "@call": "length",
                          "args": {
                            "value": {
                              "@path": "/password"
                            },
                            "min": 8
                          }
                        }
                      ]
                    }
                  },
                  "message": "Please fix errors before signing in"
                }
              ],
              "action": {
                "event": {
                  "name": "login",
                  "context": {
                    "email": {
                      "@path": "/email"
                    }
                  }
                }
              }
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "signup_text",
              "component": "Row",
              "children": [
                "no_account",
                "signup_link"
              ],
              "justify": "center"
            },
            {
              "id": "no_account",
              "component": "Text",
              "text": "Don't have an account?",
              "variant": "caption"
            },
            {
              "id": "signup_link_text",
              "component": "Text",
              "text": "Sign up"
            },
            {
              "id": "signup_link",
              "component": "Button",
              "child": "signup_link_text",
              "action": {
                "event": {
                  "name": "signup",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-login-form",
          "value": {
            "email": "",
            "password": ""
          }
        }
      }
    ]
  },
  {
    "file": "10_notification-permission.json",
    "name": "Notification Permission",
    "description": "Example of notification permission",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-notification-permission",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-notification-permission",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "icon",
                "title",
                "description",
                "actions"
              ],
              "align": "center"
            },
            {
              "id": "icon",
              "component": "Icon",
              "name": {
                "@path": "/icon"
              }
            },
            {
              "id": "title",
              "component": "Text",
              "text": {
                "@path": "/title"
              }
            },
            {
              "id": "description",
              "component": "Text",
              "text": {
                "@path": "/description"
              },
              "variant": "body"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "yes_btn",
                "no_btn"
              ],
              "justify": "center"
            },
            {
              "id": "yes_btn_text",
              "component": "Text",
              "text": "Yes"
            },
            {
              "id": "yes_btn",
              "component": "Button",
              "child": "yes_btn_text",
              "action": {
                "event": {
                  "name": "accept",
                  "context": {}
                }
              }
            },
            {
              "id": "no_btn_text",
              "component": "Text",
              "text": "No"
            },
            {
              "id": "no_btn",
              "component": "Button",
              "child": "no_btn_text",
              "action": {
                "event": {
                  "name": "decline",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-notification-permission",
          "value": {
            "icon": "check",
            "title": "Enable notification",
            "description": "Get alerts for order status changes"
          }
        }
      }
    ]
  },
  {
    "file": "11_purchase-complete.json",
    "name": "Purchase Complete",
    "description": "Example of purchase complete demonstrating currency formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-purchase-complete",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-purchase-complete",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "success_icon",
                "title",
                "product_row",
                "divider",
                "details_col",
                "view_btn"
              ],
              "align": "center"
            },
            {
              "id": "success_icon",
              "component": "Icon",
              "name": "check"
            },
            {
              "id": "title",
              "component": "Text",
              "text": "## Purchase Complete"
            },
            {
              "id": "product_row",
              "component": "Row",
              "children": [
                "product_image",
                "product_info"
              ],
              "align": "center"
            },
            {
              "id": "product_image",
              "component": "Image",
              "url": {
                "@path": "/productImage"
              },
              "fit": "cover"
            },
            {
              "id": "product_info",
              "component": "Column",
              "children": [
                "product_name",
                "product_price"
              ]
            },
            {
              "id": "product_name",
              "component": "Text",
              "text": {
                "@path": "/productName"
              }
            },
            {
              "id": "product_price",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/price"
                  },
                  "currency": "USD"
                }
              },
              "variant": "body"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "details_col",
              "component": "Column",
              "children": [
                "delivery_row",
                "seller_row"
              ]
            },
            {
              "id": "delivery_row",
              "component": "Row",
              "children": [
                "delivery_icon",
                "delivery_text"
              ],
              "align": "center"
            },
            {
              "id": "delivery_icon",
              "component": "Icon",
              "name": "arrowForward"
            },
            {
              "id": "delivery_text",
              "component": "Text",
              "text": {
                "@path": "/deliveryDate"
              },
              "variant": "body"
            },
            {
              "id": "seller_row",
              "component": "Row",
              "children": [
                "seller_label",
                "seller_name"
              ]
            },
            {
              "id": "seller_label",
              "component": "Text",
              "text": "Sold by:",
              "variant": "caption"
            },
            {
              "id": "seller_name",
              "component": "Text",
              "text": {
                "@path": "/seller"
              },
              "variant": "body"
            },
            {
              "id": "view_btn_text",
              "component": "Text",
              "text": "View Order Details"
            },
            {
              "id": "view_btn",
              "component": "Button",
              "child": "view_btn_text",
              "action": {
                "event": {
                  "name": "view_details",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-purchase-complete",
          "value": {
            "productImage": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop",
            "productName": "Wireless Headphones Pro",
            "price": 199.99,
            "deliveryDate": "Arrives Dec 18 - Dec 20",
            "seller": "TechStore Official"
          }
        }
      }
    ]
  },
  {
    "file": "12_chat-message.json",
    "name": "Chat Message",
    "description": "Example of chat message demonstrating templating and relative paths.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-chat-message",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-chat-message",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "divider",
                "messages_list"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "channel_icon",
                "channel_name"
              ],
              "align": "center"
            },
            {
              "id": "channel_icon",
              "component": "Icon",
              "name": "info"
            },
            {
              "id": "channel_name",
              "component": "Text",
              "text": {
                "@path": "/channelName"
              }
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "messages_list",
              "component": "Column",
              "children": {
                "path": "/messages",
                "componentId": "message_template"
              },
              "align": "start"
            },
            {
              "id": "message_template",
              "component": "Row",
              "children": [
                "msg_avatar",
                "msg_content"
              ],
              "align": "start"
            },
            {
              "id": "msg_avatar",
              "component": "Image",
              "url": {
                "@path": "avatar"
              },
              "fit": "cover",
              "variant": "avatar"
            },
            {
              "id": "msg_content",
              "component": "Column",
              "children": [
                "msg_header",
                "msg_text"
              ]
            },
            {
              "id": "msg_header",
              "component": "Row",
              "children": [
                "msg_username",
                "msg_time"
              ],
              "align": "center"
            },
            {
              "id": "msg_username",
              "component": "Text",
              "text": {
                "@path": "username"
              }
            },
            {
              "id": "msg_time",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "timestamp"
                  },
                  "format": "h:mm a"
                }
              },
              "variant": "caption"
            },
            {
              "id": "msg_text",
              "component": "Text",
              "text": {
                "@path": "text"
              },
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-chat-message",
          "value": {
            "channelName": "project-updates",
            "messages": [
              {
                "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop",
                "username": "Mike Chen",
                "timestamp": "2025-12-15T10:32:00Z",
                "text": "Just pushed the new API changes. Ready for review."
              },
              {
                "avatar": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop",
                "username": "Sarah Kim",
                "timestamp": "2025-12-15T10:45:00Z",
                "text": "Great! I'll take a look after standup."
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "13_coffee-order.json",
    "name": "Coffee Order",
    "description": "Example of coffee order demonstrating templating and currency formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-coffee-order",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-coffee-order",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "items_list",
                "divider",
                "totals",
                "actions"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "coffee_icon",
                "store_name"
              ],
              "align": "center"
            },
            {
              "id": "coffee_icon",
              "component": "Icon",
              "name": "favorite"
            },
            {
              "id": "store_name",
              "component": "Text",
              "text": {
                "@path": "/storeName"
              }
            },
            {
              "id": "items_list",
              "component": "Column",
              "children": {
                "path": "/items",
                "componentId": "order_item_template"
              }
            },
            {
              "id": "order_item_template",
              "component": "Row",
              "children": [
                "item_details",
                "item_price"
              ],
              "justify": "spaceBetween",
              "align": "start"
            },
            {
              "id": "item_details",
              "component": "Column",
              "children": [
                "item_name",
                "item_size"
              ]
            },
            {
              "id": "item_name",
              "component": "Text",
              "text": {
                "@path": "name"
              },
              "variant": "body"
            },
            {
              "id": "item_size",
              "component": "Text",
              "text": {
                "@path": "size"
              },
              "variant": "caption"
            },
            {
              "id": "item_price",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "price"
                  },
                  "currency": "USD"
                }
              },
              "variant": "body"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "totals",
              "component": "Column",
              "children": [
                "subtotal_row",
                "tax_row",
                "total_row"
              ]
            },
            {
              "id": "subtotal_row",
              "component": "Row",
              "children": [
                "subtotal_label",
                "subtotal_value"
              ],
              "justify": "spaceBetween"
            },
            {
              "id": "subtotal_label",
              "component": "Text",
              "text": "Subtotal",
              "variant": "caption"
            },
            {
              "id": "subtotal_value",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/subtotal"
                  },
                  "currency": "USD"
                }
              },
              "variant": "body"
            },
            {
              "id": "tax_row",
              "component": "Row",
              "children": [
                "tax_label",
                "tax_value"
              ],
              "justify": "spaceBetween"
            },
            {
              "id": "tax_label",
              "component": "Text",
              "text": "Tax",
              "variant": "caption"
            },
            {
              "id": "tax_value",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/tax"
                  },
                  "currency": "USD"
                }
              },
              "variant": "body"
            },
            {
              "id": "total_row",
              "component": "Row",
              "children": [
                "total_label",
                "total_value"
              ],
              "justify": "spaceBetween"
            },
            {
              "id": "total_label",
              "component": "Text",
              "text": "#### Total"
            },
            {
              "id": "total_value",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/total"
                  },
                  "currency": "USD"
                }
              }
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "purchase_btn",
                "add_btn"
              ]
            },
            {
              "id": "purchase_btn_text",
              "component": "Text",
              "text": "Purchase"
            },
            {
              "id": "purchase_btn",
              "component": "Button",
              "child": "purchase_btn_text",
              "action": {
                "event": {
                  "name": "purchase",
                  "context": {}
                }
              }
            },
            {
              "id": "add_btn_text",
              "component": "Text",
              "text": "Add to cart"
            },
            {
              "id": "add_btn",
              "component": "Button",
              "child": "add_btn_text",
              "action": {
                "event": {
                  "name": "add_to_cart",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-coffee-order",
          "value": {
            "storeName": "Sunrise Coffee",
            "items": [
              {
                "name": "Oat Milk Latte",
                "size": "Grande, Extra Shot",
                "price": 6.45
              },
              {
                "name": "Chocolate Croissant",
                "size": "Warmed",
                "price": 4.25
              }
            ],
            "subtotal": 10.7,
            "tax": 0.96,
            "total": 11.66
          }
        }
      }
    ]
  },
  {
    "file": "14_sports-player.json",
    "name": "Sports Player",
    "description": "Example of sports player",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-sports-player",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-sports-player",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "player_image",
                "player_info",
                "divider",
                "stats_row"
              ],
              "align": "center"
            },
            {
              "id": "player_image",
              "component": "Image",
              "url": {
                "@path": "/playerImage"
              },
              "fit": "cover"
            },
            {
              "id": "player_info",
              "component": "Column",
              "children": [
                "player_name",
                "player_details"
              ],
              "align": "center"
            },
            {
              "id": "player_name",
              "component": "Text",
              "text": {
                "@path": "/playerName"
              }
            },
            {
              "id": "player_details",
              "component": "Row",
              "children": [
                "player_number",
                "player_team"
              ],
              "align": "center"
            },
            {
              "id": "player_number",
              "component": "Text",
              "text": {
                "@path": "/number"
              }
            },
            {
              "id": "player_team",
              "component": "Text",
              "text": {
                "@path": "/team"
              },
              "variant": "caption"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "stats_row",
              "component": "Row",
              "children": [
                "stat1",
                "stat2",
                "stat3"
              ],
              "justify": "spaceAround"
            },
            {
              "id": "stat1",
              "component": "Column",
              "children": [
                "stat1_value",
                "stat1_label"
              ],
              "align": "center"
            },
            {
              "id": "stat1_value",
              "component": "Text",
              "text": {
                "@path": "/stat1/value"
              }
            },
            {
              "id": "stat1_label",
              "component": "Text",
              "text": {
                "@path": "/stat1/label"
              },
              "variant": "caption"
            },
            {
              "id": "stat2",
              "component": "Column",
              "children": [
                "stat2_value",
                "stat2_label"
              ],
              "align": "center"
            },
            {
              "id": "stat2_value",
              "component": "Text",
              "text": {
                "@path": "/stat2/value"
              }
            },
            {
              "id": "stat2_label",
              "component": "Text",
              "text": {
                "@path": "/stat2/label"
              },
              "variant": "caption"
            },
            {
              "id": "stat3",
              "component": "Column",
              "children": [
                "stat3_value",
                "stat3_label"
              ],
              "align": "center"
            },
            {
              "id": "stat3_value",
              "component": "Text",
              "text": {
                "@path": "/stat3/value"
              }
            },
            {
              "id": "stat3_label",
              "component": "Text",
              "text": {
                "@path": "/stat3/label"
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-sports-player",
          "value": {
            "playerImage": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200&h=200&fit=crop",
            "playerName": "Marcus Johnson",
            "number": "#23",
            "team": "LA Lakers",
            "stat1": {
              "value": "28.4",
              "label": "PPG"
            },
            "stat2": {
              "value": "7.2",
              "label": "RPG"
            },
            "stat3": {
              "value": "6.8",
              "label": "APG"
            }
          }
        }
      }
    ]
  },
  {
    "file": "15_account-balance.json",
    "name": "Account Balance",
    "description": "Example of account balance demonstrating currency formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-account-balance",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-account-balance",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "balance",
                "updated",
                "divider",
                "actions"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "account_icon",
                "account_name"
              ],
              "align": "center"
            },
            {
              "id": "account_icon",
              "component": "Icon",
              "name": "payment"
            },
            {
              "id": "account_name",
              "component": "Text",
              "text": {
                "@path": "/accountName"
              }
            },
            {
              "id": "balance",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/balance"
                  },
                  "currency": "USD"
                }
              }
            },
            {
              "id": "updated",
              "component": "Text",
              "text": {
                "@path": "/lastUpdated"
              },
              "variant": "caption"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "transfer_btn",
                "pay_btn"
              ]
            },
            {
              "id": "transfer_btn_text",
              "component": "Text",
              "text": "Transfer"
            },
            {
              "id": "transfer_btn",
              "component": "Button",
              "child": "transfer_btn_text",
              "action": {
                "event": {
                  "name": "transfer",
                  "context": {}
                }
              }
            },
            {
              "id": "pay_btn_text",
              "component": "Text",
              "text": "Pay Bill"
            },
            {
              "id": "pay_btn",
              "component": "Button",
              "child": "pay_btn_text",
              "action": {
                "event": {
                  "name": "pay_bill",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-account-balance",
          "value": {
            "accountName": "Primary Checking",
            "balance": 12458.32,
            "lastUpdated": "Updated just now"
          }
        }
      }
    ]
  },
  {
    "file": "16_workout-summary.json",
    "name": "Workout Summary",
    "description": "Example of workout summary demonstrating number and date formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-workout-summary",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-workout-summary",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "divider",
                "metrics_row",
                "date"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "workout_icon",
                "title"
              ],
              "align": "center"
            },
            {
              "id": "workout_icon",
              "component": "Icon",
              "name": {
                "@path": "/icon"
              }
            },
            {
              "id": "title",
              "component": "Text",
              "text": "### Workout Complete"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "metrics_row",
              "component": "Row",
              "children": [
                "duration_col",
                "calories_col",
                "distance_col"
              ],
              "justify": "spaceAround"
            },
            {
              "id": "duration_col",
              "component": "Column",
              "children": [
                "duration_value",
                "duration_label"
              ],
              "align": "center"
            },
            {
              "id": "duration_value",
              "component": "Text",
              "text": {
                "@path": "/duration"
              }
            },
            {
              "id": "duration_label",
              "component": "Text",
              "text": "Duration",
              "variant": "caption"
            },
            {
              "id": "calories_col",
              "component": "Column",
              "children": [
                "calories_value",
                "calories_label"
              ],
              "align": "center"
            },
            {
              "id": "calories_value",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "/calories"
                  }
                }
              }
            },
            {
              "id": "calories_label",
              "component": "Text",
              "text": "Calories",
              "variant": "caption"
            },
            {
              "id": "distance_col",
              "component": "Column",
              "children": [
                "distance_value",
                "distance_label"
              ],
              "align": "center"
            },
            {
              "id": "distance_value",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${/distance} km"
                }
              }
            },
            {
              "id": "distance_label",
              "component": "Text",
              "text": "Distance",
              "variant": "caption"
            },
            {
              "id": "date",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/date"
                  },
                  "format": "EEEE, MMM d 'at' h:mm a"
                }
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-workout-summary",
          "value": {
            "icon": "favorite",
            "workoutType": "Morning Run",
            "duration": "32:15",
            "calories": 385,
            "distance": 5.2,
            "date": "2025-12-15T07:30:00Z"
          }
        }
      }
    ]
  },
  {
    "file": "17_event-detail.json",
    "name": "Event Detail",
    "description": "Example of event detail demonstrating date and string formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-event-detail",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-event-detail",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "title",
                "time_row",
                "location_row",
                "description",
                "divider",
                "actions"
              ]
            },
            {
              "id": "title",
              "component": "Text",
              "text": {
                "@path": "/title"
              }
            },
            {
              "id": "time_row",
              "component": "Row",
              "children": [
                "time_icon",
                "time_text"
              ],
              "align": "center"
            },
            {
              "id": "time_icon",
              "component": "Icon",
              "name": "calendarToday"
            },
            {
              "id": "time_text",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${formatDate(value: ${/start}, format: 'E, MMM d')} • ${formatDate(value: ${/start}, format: 'h:mm a')} - ${formatDate(value: ${/end}, format: 'h:mm a')}"
                }
              },
              "variant": "body"
            },
            {
              "id": "location_row",
              "component": "Row",
              "children": [
                "location_icon",
                "location_text"
              ],
              "align": "center"
            },
            {
              "id": "location_icon",
              "component": "Icon",
              "name": "locationOn"
            },
            {
              "id": "location_text",
              "component": "Text",
              "text": {
                "@path": "/location"
              },
              "variant": "body"
            },
            {
              "id": "description",
              "component": "Text",
              "text": {
                "@path": "/description"
              },
              "variant": "body"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "accept_btn",
                "decline_btn"
              ]
            },
            {
              "id": "accept_btn_text",
              "component": "Text",
              "text": "Accept"
            },
            {
              "id": "accept_btn",
              "component": "Button",
              "child": "accept_btn_text",
              "action": {
                "event": {
                  "name": "accept",
                  "context": {}
                }
              }
            },
            {
              "id": "decline_btn_text",
              "component": "Text",
              "text": "Decline"
            },
            {
              "id": "decline_btn",
              "component": "Button",
              "child": "decline_btn_text",
              "action": {
                "event": {
                  "name": "decline",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-event-detail",
          "value": {
            "title": "Product Launch Meeting",
            "start": "2025-12-19T14:00:00Z",
            "end": "2025-12-19T15:30:00Z",
            "location": "Conference Room A, Building 2",
            "description": "Review final product specs and marketing materials before the Q1 launch."
          }
        }
      }
    ]
  },
  {
    "file": "18_track-list.json",
    "name": "Track List",
    "description": "Example of track list demonstrating templating, relative paths, and number formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-track-list",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-track-list",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "divider",
                "tracks_list"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "playlist_icon",
                "playlist_name"
              ],
              "align": "center"
            },
            {
              "id": "playlist_icon",
              "component": "Icon",
              "name": "play"
            },
            {
              "id": "playlist_name",
              "component": "Text",
              "text": {
                "@path": "/playlistName"
              }
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "tracks_list",
              "component": "Column",
              "children": {
                "path": "/tracks",
                "componentId": "track_item_template"
              }
            },
            {
              "id": "track_item_template",
              "component": "Row",
              "children": [
                "track_num",
                "track_art",
                "track_info",
                "track_duration"
              ],
              "align": "center"
            },
            {
              "id": "track_num",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "number"
                  }
                }
              },
              "variant": "caption"
            },
            {
              "id": "track_art",
              "component": "Image",
              "url": {
                "@path": "art"
              },
              "fit": "cover"
            },
            {
              "id": "track_info",
              "component": "Column",
              "children": [
                "track_title",
                "track_artist"
              ]
            },
            {
              "id": "track_title",
              "component": "Text",
              "text": {
                "@path": "title"
              },
              "variant": "body"
            },
            {
              "id": "track_artist",
              "component": "Text",
              "text": {
                "@path": "artist"
              },
              "variant": "caption"
            },
            {
              "id": "track_duration",
              "component": "Text",
              "text": {
                "@path": "duration"
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-track-list",
          "value": {
            "playlistName": "Focus Flow",
            "tracks": [
              {
                "number": 1,
                "art": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=50&h=50&fit=crop",
                "title": "Weightless",
                "artist": "Marconi Union",
                "duration": "8:09"
              },
              {
                "number": 2,
                "art": "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=50&h=50&fit=crop",
                "title": "Clair de Lune",
                "artist": "Debussy",
                "duration": "5:12"
              },
              {
                "number": 3,
                "art": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=50&h=50&fit=crop",
                "title": "Ambient Light",
                "artist": "Brian Eno",
                "duration": "6:45"
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "19_software-purchase.json",
    "name": "Software Purchase",
    "description": "Example of software purchase demonstrating currency formatting and ChoicePicker.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-software-purchase",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-software-purchase",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "title",
                "product_name",
                "divider1",
                "options",
                "divider2",
                "total_row",
                "actions"
              ]
            },
            {
              "id": "title",
              "component": "Text",
              "text": "### Purchase License"
            },
            {
              "id": "product_name",
              "component": "Text",
              "text": {
                "@path": "/productName"
              }
            },
            {
              "id": "divider1",
              "component": "Divider"
            },
            {
              "id": "options",
              "component": "Column",
              "children": [
                "seats_row",
                "period_row"
              ]
            },
            {
              "id": "seats_row",
              "component": "Row",
              "children": [
                "seats_label",
                "seats_value"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "seats_label",
              "component": "Text",
              "text": "Number of seats",
              "variant": "body"
            },
            {
              "id": "seats_value",
              "component": "Text",
              "text": {
                "@path": "/seats"
              }
            },
            {
              "id": "period_row",
              "component": "Row",
              "children": [
                "period_label",
                "period_picker"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "period_label",
              "component": "Text",
              "text": "Billing period",
              "variant": "body"
            },
            {
              "id": "period_picker",
              "component": "ChoicePicker",
              "options": [
                {
                  "label": "Annual",
                  "value": "annual"
                },
                {
                  "label": "Monthly",
                  "value": "monthly"
                }
              ],
              "value": {
                "@path": "/billingPeriod"
              },
              "variant": "mutuallyExclusive",
              "displayStyle": "chips"
            },
            {
              "id": "divider2",
              "component": "Divider"
            },
            {
              "id": "total_row",
              "component": "Row",
              "children": [
                "total_label",
                "total_value"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "total_label",
              "component": "Text",
              "text": "#### Total"
            },
            {
              "id": "total_value",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${formatCurrency(value: ${/total}, currency: 'USD')}/year"
                }
              }
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "confirm_btn",
                "cancel_btn"
              ]
            },
            {
              "id": "confirm_btn_text",
              "component": "Text",
              "text": "Confirm Purchase"
            },
            {
              "id": "confirm_btn",
              "component": "Button",
              "child": "confirm_btn_text",
              "action": {
                "event": {
                  "name": "confirm",
                  "context": {}
                }
              }
            },
            {
              "id": "cancel_btn_text",
              "component": "Text",
              "text": "Cancel"
            },
            {
              "id": "cancel_btn",
              "component": "Button",
              "child": "cancel_btn_text",
              "action": {
                "event": {
                  "name": "cancel",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-software-purchase",
          "value": {
            "productName": "Design Suite Pro",
            "seats": "10 seats",
            "billingPeriod": [
              "annual"
            ],
            "total": 1188.0
          }
        }
      }
    ]
  },
  {
    "file": "20_restaurant-card.json",
    "name": "Restaurant Card",
    "description": "Example of restaurant card",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-restaurant-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-restaurant-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "restaurant_image",
                "content"
              ]
            },
            {
              "id": "restaurant_image",
              "component": "Image",
              "url": {
                "@path": "/image"
              },
              "fit": "cover"
            },
            {
              "id": "content",
              "component": "Column",
              "children": [
                "name_row",
                "cuisine",
                "rating_row",
                "details_row"
              ]
            },
            {
              "id": "name_row",
              "component": "Row",
              "children": [
                "restaurant_name",
                "price_range"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "restaurant_name",
              "component": "Text",
              "text": {
                "@path": "/name"
              }
            },
            {
              "id": "price_range",
              "component": "Text",
              "text": {
                "@path": "/priceRange"
              },
              "variant": "body"
            },
            {
              "id": "cuisine",
              "component": "Text",
              "text": {
                "@path": "/cuisine"
              },
              "variant": "caption"
            },
            {
              "id": "rating_row",
              "component": "Row",
              "children": [
                "star_icon",
                "rating",
                "reviews"
              ],
              "align": "center"
            },
            {
              "id": "star_icon",
              "component": "Icon",
              "name": "star"
            },
            {
              "id": "rating",
              "component": "Text",
              "text": {
                "@path": "/rating"
              },
              "variant": "body"
            },
            {
              "id": "reviews",
              "component": "Text",
              "text": {
                "@path": "/reviewCount"
              },
              "variant": "caption"
            },
            {
              "id": "details_row",
              "component": "Row",
              "children": [
                "distance",
                "delivery_time"
              ]
            },
            {
              "id": "distance",
              "component": "Text",
              "text": {
                "@path": "/distance"
              },
              "variant": "caption"
            },
            {
              "id": "delivery_time",
              "component": "Text",
              "text": {
                "@path": "/deliveryTime"
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-restaurant-card",
          "value": {
            "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=150&fit=crop",
            "name": "The Italian Kitchen",
            "priceRange": "$$$",
            "cuisine": "Italian • Pasta • Wine Bar",
            "rating": "4.8",
            "reviewCount": "(2,847 reviews)",
            "distance": "0.8 mi",
            "deliveryTime": "25-35 min"
          }
        }
      }
    ]
  },
  {
    "file": "21_shipping-status.json",
    "name": "Shipping Status",
    "description": "Example of shipping status demonstrating templating and relative paths.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-shipping-status",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-shipping-status",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "tracking_number",
                "divider",
                "steps_list",
                "eta"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "package_icon",
                "title"
              ],
              "align": "center"
            },
            {
              "id": "package_icon",
              "component": "Icon",
              "name": "info"
            },
            {
              "id": "title",
              "component": "Text",
              "text": "### Package Status"
            },
            {
              "id": "tracking_number",
              "component": "Text",
              "text": {
                "@path": "/trackingNumber"
              },
              "variant": "caption"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "steps_list",
              "component": "Column",
              "children": {
                "path": "/steps",
                "componentId": "step_item_template"
              }
            },
            {
              "id": "step_item_template",
              "component": "Row",
              "children": [
                "step_icon",
                "step_text"
              ],
              "align": "center"
            },
            {
              "id": "step_icon",
              "component": "Icon",
              "name": {
                "@path": "icon"
              }
            },
            {
              "id": "step_text",
              "component": "Text",
              "text": {
                "@path": "label"
              },
              "variant": "body"
            },
            {
              "id": "eta",
              "component": "Row",
              "children": [
                "eta_icon",
                "eta_text"
              ],
              "align": "center"
            },
            {
              "id": "eta_icon",
              "component": "Icon",
              "name": "calendarToday"
            },
            {
              "id": "eta_text",
              "component": "Text",
              "text": {
                "@path": "/eta"
              },
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-shipping-status",
          "value": {
            "trackingNumber": "Tracking: 1Z999AA10123456784",
            "steps": [
              {
                "icon": "check",
                "label": "Order Placed"
              },
              {
                "icon": "check",
                "label": "Shipped"
              },
              {
                "icon": "send",
                "label": "Out for Delivery"
              },
              {
                "icon": "check",
                "label": "Delivered"
              }
            ],
            "eta": "Estimated delivery: Today by 8 PM"
          }
        }
      }
    ]
  },
  {
    "file": "22_credit-card.json",
    "name": "Credit Card",
    "description": "Example of credit card",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-credit-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-credit-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "card_type_row",
                "card_number",
                "card_details"
              ]
            },
            {
              "id": "card_type_row",
              "component": "Row",
              "children": [
                "card_icon",
                "card_type"
              ],
              "justify": "spaceBetween",
              "align": "center"
            },
            {
              "id": "card_icon",
              "component": "Icon",
              "name": "payment"
            },
            {
              "id": "card_type",
              "component": "Text",
              "text": {
                "@path": "/cardType"
              }
            },
            {
              "id": "card_number",
              "component": "Text",
              "text": {
                "@path": "/cardNumber"
              }
            },
            {
              "id": "card_details",
              "component": "Row",
              "children": [
                "holder_col",
                "expiry_col"
              ],
              "justify": "spaceBetween"
            },
            {
              "id": "holder_col",
              "component": "Column",
              "children": [
                "holder_label",
                "holder_name"
              ]
            },
            {
              "id": "holder_label",
              "component": "Text",
              "text": "CARD HOLDER",
              "variant": "caption"
            },
            {
              "id": "holder_name",
              "component": "Text",
              "text": {
                "@path": "/holderName"
              },
              "variant": "body"
            },
            {
              "id": "expiry_col",
              "component": "Column",
              "children": [
                "expiry_label",
                "expiry_date"
              ],
              "align": "end"
            },
            {
              "id": "expiry_label",
              "component": "Text",
              "text": "EXPIRES",
              "variant": "caption"
            },
            {
              "id": "expiry_date",
              "component": "Text",
              "text": {
                "@path": "/expiryDate"
              },
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-credit-card",
          "value": {
            "cardType": "VISA",
            "cardNumber": "•••• •••• •••• 4242",
            "holderName": "SARAH JOHNSON",
            "expiryDate": "09/27"
          }
        }
      }
    ]
  },
  {
    "file": "23_step-counter.json",
    "name": "Step Counter",
    "description": "Example of step counter demonstrating number formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-step-counter",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-step-counter",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "steps_display",
                "goal_text",
                "divider",
                "stats_row"
              ],
              "align": "center"
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "steps_icon",
                "title"
              ],
              "align": "center"
            },
            {
              "id": "steps_icon",
              "component": "Icon",
              "name": "person"
            },
            {
              "id": "title",
              "component": "Text",
              "text": "#### Today's Steps"
            },
            {
              "id": "steps_display",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "/steps"
                  }
                }
              }
            },
            {
              "id": "goal_text",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${/progress}% of ${formatNumber(value: ${/goal})} goal"
                }
              },
              "variant": "body"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "stats_row",
              "component": "Row",
              "children": [
                "distance_col",
                "calories_col"
              ],
              "justify": "spaceAround"
            },
            {
              "id": "distance_col",
              "component": "Column",
              "children": [
                "distance_value",
                "distance_label"
              ],
              "align": "center"
            },
            {
              "id": "distance_value",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${/distance} mi"
                }
              }
            },
            {
              "id": "distance_label",
              "component": "Text",
              "text": "Distance",
              "variant": "caption"
            },
            {
              "id": "calories_col",
              "component": "Column",
              "children": [
                "calories_value",
                "calories_label"
              ],
              "align": "center"
            },
            {
              "id": "calories_value",
              "component": "Text",
              "text": {
                "@call": "formatNumber",
                "args": {
                  "value": {
                    "@path": "/calories"
                  }
                }
              }
            },
            {
              "id": "calories_label",
              "component": "Text",
              "text": "Calories",
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-step-counter",
          "value": {
            "steps": 8432,
            "goal": 10000,
            "progress": 84,
            "distance": 3.8,
            "calories": 312
          }
        }
      }
    ]
  },
  {
    "file": "24_recipe-card.json",
    "name": "Recipe Card",
    "description": "Example of recipe card demonstrating Tabs and pluralization.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-recipe-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-recipe-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "tabs_container"
            },
            {
              "id": "tabs_container",
              "component": "Tabs",
              "tabs": [
                {
                  "title": "Overview",
                  "child": "overview_col"
                },
                {
                  "title": "Ingredients",
                  "child": "ingredients_list"
                },
                {
                  "title": "Instructions",
                  "child": "instructions_list"
                }
              ]
            },
            {
              "id": "overview_col",
              "component": "Column",
              "children": [
                "recipe_image",
                "overview_content"
              ]
            },
            {
              "id": "recipe_image",
              "component": "Image",
              "url": {
                "@path": "/image"
              },
              "fit": "cover"
            },
            {
              "id": "overview_content",
              "component": "Column",
              "children": [
                "title",
                "rating_row",
                "times_row",
                "servings"
              ]
            },
            {
              "id": "title",
              "component": "Text",
              "text": {
                "@path": "/title"
              }
            },
            {
              "id": "rating_row",
              "component": "Row",
              "children": [
                "star_icon",
                "rating",
                "review_count"
              ],
              "align": "center"
            },
            {
              "id": "star_icon",
              "component": "Icon",
              "name": "star"
            },
            {
              "id": "rating",
              "component": "Text",
              "text": {
                "@path": "/rating"
              },
              "variant": "body"
            },
            {
              "id": "review_count",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "(${formatNumber(value: ${/reviewCount})} ${pluralize(value: ${/reviewCount}, one: 'review', other: 'reviews')})"
                }
              },
              "variant": "caption"
            },
            {
              "id": "times_row",
              "component": "Row",
              "children": [
                "prep_time",
                "cook_time"
              ]
            },
            {
              "id": "prep_time",
              "component": "Row",
              "children": [
                "prep_icon",
                "prep_text"
              ],
              "align": "center"
            },
            {
              "id": "prep_icon",
              "component": "Icon",
              "name": "calendarToday"
            },
            {
              "id": "prep_text",
              "component": "Text",
              "text": {
                "@path": "/prepTime"
              },
              "variant": "caption"
            },
            {
              "id": "cook_time",
              "component": "Row",
              "children": [
                "cook_icon",
                "cook_text"
              ],
              "align": "center"
            },
            {
              "id": "cook_icon",
              "component": "Icon",
              "name": "warning"
            },
            {
              "id": "cook_text",
              "component": "Text",
              "text": {
                "@path": "/cookTime"
              },
              "variant": "caption"
            },
            {
              "id": "servings",
              "component": "Text",
              "text": {
                "@path": "/servings"
              },
              "variant": "caption"
            },
            {
              "id": "ingredients_list",
              "component": "Column",
              "children": {
                "path": "/ingredients",
                "componentId": "item_template"
              }
            },
            {
              "id": "instructions_list",
              "component": "Column",
              "children": {
                "path": "/instructions",
                "componentId": "item_template"
              }
            },
            {
              "id": "item_template",
              "component": "Text",
              "text": {
                "@path": "text"
              },
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-recipe-card",
          "value": {
            "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=180&fit=crop",
            "title": "Mediterranean Quinoa Bowl",
            "rating": "4.9",
            "reviewCount": 1247,
            "prepTime": "15 min prep",
            "cookTime": "20 min cook",
            "servings": "Serves 4",
            "ingredients": [
              {
                "text": "1 cup quinoa"
              },
              {
                "text": "2 cups water"
              },
              {
                "text": "1 cucumber, diced"
              },
              {
                "text": "1 cup cherry tomatoes, halved"
              }
            ],
            "instructions": [
              {
                "text": "1. Rinse quinoa and bring to a boil in water."
              },
              {
                "text": "2. Reduce heat and simmer for 15 minutes."
              },
              {
                "text": "3. Fluff with a fork and let cool."
              },
              {
                "text": "4. Mix with diced vegetables."
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "25_contact-card.json",
    "name": "Contact Card",
    "description": "Example of contact card",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-contact-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-contact-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "avatar_image",
                "name",
                "title",
                "divider",
                "contact_info",
                "actions"
              ],
              "align": "center"
            },
            {
              "id": "avatar_image",
              "component": "Image",
              "url": {
                "@path": "/avatar"
              },
              "fit": "cover",
              "variant": "avatar"
            },
            {
              "id": "name",
              "component": "Text",
              "text": {
                "@path": "/name"
              }
            },
            {
              "id": "title",
              "component": "Text",
              "text": {
                "@path": "/title"
              },
              "variant": "body"
            },
            {
              "id": "divider",
              "component": "Divider"
            },
            {
              "id": "contact_info",
              "component": "Column",
              "children": [
                "phone_row",
                "email_row",
                "location_row"
              ]
            },
            {
              "id": "phone_row",
              "component": "Row",
              "children": [
                "phone_icon",
                "phone_text"
              ],
              "align": "center"
            },
            {
              "id": "phone_icon",
              "component": "Icon",
              "name": "phone"
            },
            {
              "id": "phone_text",
              "component": "Text",
              "text": {
                "@path": "/phone"
              },
              "variant": "body"
            },
            {
              "id": "email_row",
              "component": "Row",
              "children": [
                "email_icon",
                "email_text"
              ],
              "align": "center"
            },
            {
              "id": "email_icon",
              "component": "Icon",
              "name": "mail"
            },
            {
              "id": "email_text",
              "component": "Text",
              "text": {
                "@path": "/email"
              },
              "variant": "body"
            },
            {
              "id": "location_row",
              "component": "Row",
              "children": [
                "location_icon",
                "location_text"
              ],
              "align": "center"
            },
            {
              "id": "location_icon",
              "component": "Icon",
              "name": "locationOn"
            },
            {
              "id": "location_text",
              "component": "Text",
              "text": {
                "@path": "/location"
              },
              "variant": "body"
            },
            {
              "id": "actions",
              "component": "Row",
              "children": [
                "call_btn",
                "message_btn"
              ]
            },
            {
              "id": "call_btn_text",
              "component": "Text",
              "text": "Call"
            },
            {
              "id": "call_btn",
              "component": "Button",
              "child": "call_btn_text",
              "action": {
                "event": {
                  "name": "call",
                  "context": {}
                }
              }
            },
            {
              "id": "message_btn_text",
              "component": "Text",
              "text": "Message"
            },
            {
              "id": "message_btn",
              "component": "Button",
              "child": "message_btn_text",
              "action": {
                "event": {
                  "name": "message",
                  "context": {}
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-contact-card",
          "value": {
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
            "name": "David Park",
            "title": "Engineering Manager",
            "phone": "+1 (555) 234-5678",
            "email": "david.park@company.com",
            "location": "San Francisco, CA"
          }
        }
      }
    ]
  },
  {
    "file": "26_podcast-episode.json",
    "name": "Podcast Episode",
    "description": "Example of podcast episode demonstrating AudioPlayer and date formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-podcast-episode",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-podcast-episode",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_row"
            },
            {
              "id": "main_row",
              "component": "Row",
              "children": [
                "artwork",
                "content"
              ],
              "align": "start"
            },
            {
              "id": "artwork",
              "component": "Image",
              "url": {
                "@path": "/artwork"
              },
              "fit": "cover"
            },
            {
              "id": "content",
              "component": "Column",
              "children": [
                "show_name",
                "episode_title",
                "meta_row",
                "description",
                "audio_player"
              ]
            },
            {
              "id": "show_name",
              "component": "Text",
              "text": {
                "@path": "/showName"
              },
              "variant": "caption"
            },
            {
              "id": "episode_title",
              "component": "Text",
              "text": {
                "@path": "/episodeTitle"
              }
            },
            {
              "id": "meta_row",
              "component": "Row",
              "children": [
                "duration",
                "date"
              ]
            },
            {
              "id": "duration",
              "component": "Text",
              "text": {
                "@path": "/duration"
              },
              "variant": "caption"
            },
            {
              "id": "date",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/date"
                  },
                  "format": "MMM d, yyyy"
                }
              },
              "variant": "caption"
            },
            {
              "id": "description",
              "component": "Text",
              "text": {
                "@path": "/description"
              },
              "variant": "body"
            },
            {
              "id": "audio_player",
              "component": "AudioPlayer",
              "url": {
                "@path": "/audioUrl"
              },
              "description": {
                "@path": "/episodeTitle"
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-podcast-episode",
          "value": {
            "artwork": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=100&h=100&fit=crop",
            "showName": "Tech Talk Daily",
            "episodeTitle": "The Future of AI in Product Design",
            "duration": "45 min",
            "date": "2024-12-15",
            "description": "How AI is transforming the way we design and build products.",
            "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
          }
        }
      }
    ]
  },
  {
    "file": "27_stats-card.json",
    "name": "Stats Card",
    "description": "Example of stats card demonstrating currency and number formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-stats-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-stats-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header",
                "value",
                "trend_row"
              ]
            },
            {
              "id": "header",
              "component": "Row",
              "children": [
                "metric_icon",
                "metric_name"
              ],
              "align": "center"
            },
            {
              "id": "metric_icon",
              "component": "Icon",
              "name": {
                "@path": "/icon"
              }
            },
            {
              "id": "metric_name",
              "component": "Text",
              "text": {
                "@path": "/metricName"
              },
              "variant": "caption"
            },
            {
              "id": "value",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "/value"
                  },
                  "currency": "USD"
                }
              }
            },
            {
              "id": "trend_row",
              "component": "Row",
              "children": [
                "trend_icon",
                "trend_text"
              ],
              "align": "center"
            },
            {
              "id": "trend_icon",
              "component": "Icon",
              "name": {
                "@path": "/trendIcon"
              }
            },
            {
              "id": "trend_text",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "+${/trendPercent}% from last month"
                }
              },
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-stats-card",
          "value": {
            "icon": "payment",
            "metricName": "Monthly Revenue",
            "value": 48294,
            "trendIcon": "arrowForward",
            "trendPercent": 12.5
          }
        }
      }
    ]
  },
  {
    "file": "28_countdown-timer.json",
    "name": "Countdown Timer",
    "description": "Example of countdown timer demonstrating date formatting.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-countdown-timer",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-countdown-timer",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "event_name",
                "countdown_row",
                "target_date"
              ],
              "align": "center"
            },
            {
              "id": "event_name",
              "component": "Text",
              "text": {
                "@path": "/eventName"
              }
            },
            {
              "id": "countdown_row",
              "component": "Row",
              "children": [
                "days_col",
                "hours_col",
                "minutes_col"
              ],
              "justify": "spaceAround"
            },
            {
              "id": "days_col",
              "component": "Column",
              "children": [
                "days_value",
                "days_label"
              ],
              "align": "center"
            },
            {
              "id": "days_value",
              "component": "Text",
              "text": {
                "@path": "/days"
              }
            },
            {
              "id": "days_label",
              "component": "Text",
              "text": "Days",
              "variant": "caption"
            },
            {
              "id": "hours_col",
              "component": "Column",
              "children": [
                "hours_value",
                "hours_label"
              ],
              "align": "center"
            },
            {
              "id": "hours_value",
              "component": "Text",
              "text": {
                "@path": "/hours"
              }
            },
            {
              "id": "hours_label",
              "component": "Text",
              "text": "Hours",
              "variant": "caption"
            },
            {
              "id": "minutes_col",
              "component": "Column",
              "children": [
                "minutes_value",
                "minutes_label"
              ],
              "align": "center"
            },
            {
              "id": "minutes_value",
              "component": "Text",
              "text": {
                "@path": "/minutes"
              }
            },
            {
              "id": "minutes_label",
              "component": "Text",
              "text": "Minutes",
              "variant": "caption"
            },
            {
              "id": "target_date",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/targetDate"
                  },
                  "format": "MMMM d, yyyy"
                }
              },
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-countdown-timer",
          "value": {
            "eventName": "Product Launch",
            "days": "14",
            "hours": "08",
            "minutes": "32",
            "targetDate": "2025-01-15"
          }
        }
      }
    ]
  },
  {
    "file": "29_movie-card.json",
    "name": "Movie Card",
    "description": "Example of movie card demonstrating Modal and Video components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-movie-card",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-movie-card",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "poster",
                "content",
                "trailer_modal"
              ]
            },
            {
              "id": "poster",
              "component": "Image",
              "url": {
                "@path": "/poster"
              },
              "fit": "cover"
            },
            {
              "id": "content",
              "component": "Column",
              "children": [
                "title_row",
                "genre",
                "rating_row",
                "runtime",
                "watch_trailer_btn"
              ]
            },
            {
              "id": "title_row",
              "component": "Row",
              "children": [
                "movie_title",
                "year"
              ],
              "align": "start"
            },
            {
              "id": "movie_title",
              "component": "Text",
              "text": {
                "@path": "/title"
              }
            },
            {
              "id": "year",
              "component": "Text",
              "text": {
                "@path": "/year"
              },
              "variant": "caption"
            },
            {
              "id": "genre",
              "component": "Text",
              "text": {
                "@path": "/genre"
              },
              "variant": "caption"
            },
            {
              "id": "rating_row",
              "component": "Row",
              "children": [
                "star_icon",
                "rating_value"
              ],
              "align": "center"
            },
            {
              "id": "star_icon",
              "component": "Icon",
              "name": "star"
            },
            {
              "id": "rating_value",
              "component": "Text",
              "text": {
                "@path": "/rating"
              },
              "variant": "body"
            },
            {
              "id": "runtime",
              "component": "Row",
              "children": [
                "time_icon",
                "runtime_text"
              ],
              "align": "center"
            },
            {
              "id": "time_icon",
              "component": "Icon",
              "name": "calendarToday"
            },
            {
              "id": "runtime_text",
              "component": "Text",
              "text": {
                "@path": "/runtime"
              },
              "variant": "caption"
            },
            {
              "id": "watch_trailer_btn_text",
              "component": "Text",
              "text": "Watch Trailer"
            },
            {
              "id": "watch_trailer_btn",
              "component": "Button",
              "child": "watch_trailer_btn_text",
              "action": {
                "event": {
                  "name": "open_trailer"
                }
              }
            },
            {
              "id": "trailer_modal",
              "component": "Modal",
              "trigger": "watch_trailer_btn",
              "content": "trailer_video"
            },
            {
              "id": "trailer_video",
              "component": "Video",
              "url": {
                "@path": "/trailerUrl"
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-movie-card",
          "value": {
            "poster": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&h=300&fit=crop",
            "title": "Interstellar",
            "year": "(2014)",
            "genre": "Sci-Fi • Adventure • Drama",
            "rating": "8.7/10",
            "runtime": "2h 49min",
            "trailerUrl": "https://www.w3schools.com/html/mov_bbb.mp4"
          }
        }
      }
    ]
  },
  {
    "file": "30_live-invitation-builder.json",
    "name": "Live Invitation Builder",
    "description": "Demonstrates reactive two-way binding where editor inputs update a live preview in real-time.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-invitation-builder",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-invitation-builder",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "header",
                "main_content"
              ],
              "align": "stretch"
            },
            {
              "id": "header",
              "component": "Text",
              "text": "# Invitation Builder"
            },
            {
              "id": "main_content",
              "component": "Row",
              "children": [
                "editor_col",
                "preview_col"
              ],
              "align": "start"
            },
            {
              "id": "editor_col",
              "component": "Column",
              "children": [
                "editor_title",
                "event_name_input",
                "guest_input",
                "date_input",
                "location_picker"
              ],
              "weight": 1,
              "align": "stretch"
            },
            {
              "id": "editor_title",
              "component": "Text",
              "text": "### Customize your invitation"
            },
            {
              "id": "event_name_input",
              "component": "TextField",
              "label": "Event Name",
              "value": {
                "@path": "/event/name"
              }
            },
            {
              "id": "guest_input",
              "component": "TextField",
              "label": "Guest of Honor",
              "value": {
                "@path": "/event/guest"
              }
            },
            {
              "id": "date_input",
              "component": "DateTimeInput",
              "label": "Event Date & Time",
              "value": {
                "@path": "/event/date"
              },
              "enableDate": true,
              "enableTime": true
            },
            {
              "id": "location_picker",
              "component": "ChoicePicker",
              "label": "Location",
              "options": [
                {
                  "label": "Grand Ballroom",
                  "value": "ballroom"
                },
                {
                  "label": "Sunset Terrace",
                  "value": "terrace"
                },
                {
                  "label": "Garden Pavillion",
                  "value": "garden"
                }
              ],
              "value": {
                "@path": "/event/location"
              },
              "variant": "mutuallyExclusive",
              "displayStyle": "chips"
            },
            {
              "id": "preview_col",
              "component": "Column",
              "children": [
                "preview_title",
                "invitation_card"
              ],
              "weight": 1,
              "align": "center"
            },
            {
              "id": "preview_title",
              "component": "Text",
              "text": "Live Preview",
              "variant": "caption"
            },
            {
              "id": "invitation_card",
              "component": "Card",
              "child": "invitation_content"
            },
            {
              "id": "invitation_content",
              "component": "Column",
              "children": [
                "invite_image",
                "invite_event_name",
                "invite_guest_row",
                "invite_date_text",
                "invite_location_text"
              ],
              "align": "center"
            },
            {
              "id": "invite_image",
              "component": "Image",
              "url": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=200&fit=crop",
              "variant": "mediumFeature"
            },
            {
              "id": "invite_event_name",
              "component": "Text",
              "text": {
                "@path": "/event/name"
              }
            },
            {
              "id": "invite_guest_row",
              "component": "Row",
              "children": [
                "invite_for_text",
                "invite_guest_name"
              ],
              "align": "center"
            },
            {
              "id": "invite_for_text",
              "component": "Text",
              "text": "Celebrating",
              "variant": "body"
            },
            {
              "id": "invite_guest_name",
              "component": "Text",
              "text": {
                "@path": "/event/guest"
              }
            },
            {
              "id": "invite_date_text",
              "component": "Text",
              "text": {
                "@call": "formatDate",
                "args": {
                  "value": {
                    "@path": "/event/date"
                  },
                  "format": "EEEE, MMMM d, yyyy 'at' h:mm a"
                }
              },
              "variant": "body"
            },
            {
              "id": "invite_location_text",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "Location: ${/event/location/0}"
                }
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-invitation-builder",
          "value": {
            "event": {
              "name": "Summer Gala",
              "guest": "Alex Johnson",
              "date": "2025-07-15T19:00:00Z",
              "location": [
                "terrace"
              ]
            }
          }
        }
      }
    ]
  },
  {
    "file": "31_incremental-dashboard.json",
    "name": "Incremental Dashboard",
    "description": "Demonstrates structural evolution of a UI where loading placeholders are incrementally replaced by actual components.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-incremental-dashboard",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-incremental-dashboard",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "header",
                "content_grid"
              ],
              "align": "stretch"
            },
            {
              "id": "header",
              "component": "Text",
              "text": "## System Dashboard"
            },
            {
              "id": "content_grid",
              "component": "Row",
              "children": [
                "left_panel",
                "right_panel"
              ]
            },
            {
              "id": "left_panel",
              "component": "Column",
              "children": [
                "panel_a_loading"
              ],
              "weight": 1
            },
            {
              "id": "right_panel",
              "component": "Column",
              "children": [
                "panel_b_loading"
              ],
              "weight": 1
            },
            {
              "id": "panel_a_loading",
              "component": "Text",
              "text": "Loading analytics...",
              "variant": "caption"
            },
            {
              "id": "panel_b_loading",
              "component": "Text",
              "text": "Loading logs...",
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-incremental-dashboard",
          "components": [
            {
              "id": "left_panel",
              "component": "Column",
              "children": [
                "analytics_card"
              ],
              "weight": 1
            },
            {
              "id": "analytics_card",
              "component": "Card",
              "child": "analytics_text"
            },
            {
              "id": "analytics_text",
              "component": "Text",
              "text": "Analytics are ready.",
              "variant": "body"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-incremental-dashboard",
          "components": [
            {
              "id": "right_panel",
              "component": "Column",
              "children": [
                "logs_list"
              ],
              "weight": 1
            },
            {
              "id": "logs_list",
              "component": "List",
              "children": {
                "path": "/logs",
                "componentId": "log_template"
              }
            },
            {
              "id": "log_template",
              "component": "Text",
              "text": {
                "@path": "message"
              },
              "variant": "caption"
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-incremental-dashboard",
          "value": {
            "logs": [
              {
                "message": "System boot complete."
              },
              {
                "message": "All services healthy."
              },
              {
                "message": "Waiting for user input."
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "32_advanced-form-validator.json",
    "name": "Advanced Form Validator",
    "description": "Demonstrates complex validation logic and deeply nested formatting functions.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-advanced-validator",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-advanced-validator",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "welcome_text",
                "email_field",
                "phone_field",
                "zip_field",
                "terms_checkbox",
                "submit_btn"
              ],
              "align": "stretch"
            },
            {
              "id": "welcome_text",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "Hello! Today is ${formatDate(value: ${/now}, format: 'EEEE, MMMM d')}."
                }
              }
            },
            {
              "id": "email_field",
              "component": "TextField",
              "label": "Email Address",
              "value": {
                "@path": "/formData/email"
              },
              "checks": [
                {
                  "condition": {
                    "@call": "email",
                    "args": {
                      "value": {
                        "@path": "/formData/email"
                      }
                    }
                  },
                  "message": "Invalid email format"
                }
              ]
            },
            {
              "id": "phone_field",
              "component": "TextField",
              "label": "Phone Number",
              "value": {
                "@path": "/formData/phone"
              },
              "checks": [
                {
                  "condition": {
                    "@call": "regex",
                    "args": {
                      "value": {
                        "@path": "/formData/phone"
                      },
                      "pattern": "^\\+?[0-9]{10,15}$"
                    }
                  },
                  "message": "Invalid phone format"
                }
              ]
            },
            {
              "id": "zip_field",
              "component": "TextField",
              "label": "Zip Code",
              "value": {
                "@path": "/formData/zip"
              },
              "checks": [
                {
                  "condition": {
                    "@call": "regex",
                    "args": {
                      "value": {
                        "@path": "/formData/zip"
                      },
                      "pattern": "^[0-9]{5}$"
                    }
                  },
                  "message": "Must be exactly 5 digits"
                }
              ]
            },
            {
              "id": "terms_checkbox",
              "component": "CheckBox",
              "label": "I agree to the terms and conditions",
              "value": {
                "@path": "/formData/agree"
              }
            },
            {
              "id": "submit_btn_text",
              "component": "Text",
              "text": "Submit Registration"
            },
            {
              "id": "submit_btn",
              "component": "Button",
              "child": "submit_btn_text",
              "checks": [
                {
                  "condition": {
                    "@call": "and",
                    "args": {
                      "values": [
                        {
                          "@path": "/formData/agree"
                        },
                        {
                          "@call": "or",
                          "args": {
                            "values": [
                              {
                                "@call": "required",
                                "args": {
                                  "value": {
                                    "@path": "/formData/email"
                                  }
                                }
                              },
                              {
                                "@call": "required",
                                "args": {
                                  "value": {
                                    "@path": "/formData/phone"
                                  }
                                }
                              }
                            ]
                          }
                        },
                        {
                          "@call": "required",
                          "args": {
                            "value": {
                              "@path": "/formData/zip"
                            }
                          }
                        }
                      ]
                    }
                  },
                  "message": "You must agree to terms AND provide either Email or Phone, plus a Zip code."
                }
              ],
              "action": {
                "event": {
                  "name": "register",
                  "context": {
                    "data": {
                      "@path": "/formData"
                    }
                  }
                }
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-advanced-validator",
          "value": {
            "now": "2025-12-15T12:00:00Z",
            "formData": {
              "email": "",
              "phone": "",
              "zip": "",
              "agree": false
            }
          }
        }
      }
    ]
  },
  {
    "file": "33_financial-data-grid.json",
    "name": "Financial Data Grid",
    "description": "Demonstrates complex layout weighting and alignment using Rows and Columns with templates.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-financial-grid",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-financial-grid",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "header_row",
                "grid_list"
              ],
              "align": "stretch"
            },
            {
              "id": "header_row",
              "component": "Row",
              "children": [
                "col_asset",
                "col_price",
                "col_change",
                "col_market_cap"
              ],
              "align": "center"
            },
            {
              "id": "col_asset",
              "component": "Text",
              "text": "Asset",
              "variant": "caption",
              "weight": 2
            },
            {
              "id": "col_price",
              "component": "Text",
              "text": "Price",
              "variant": "caption",
              "weight": 1
            },
            {
              "id": "col_change",
              "component": "Text",
              "text": "24h Change",
              "variant": "caption",
              "weight": 1
            },
            {
              "id": "col_market_cap",
              "component": "Text",
              "text": "Market Cap",
              "variant": "caption",
              "weight": 1.5
            },
            {
              "id": "grid_list",
              "component": "List",
              "children": {
                "path": "/assets",
                "componentId": "row_template"
              }
            },
            {
              "id": "row_template",
              "component": "Row",
              "children": [
                "asset_info",
                "asset_price",
                "asset_change",
                "asset_market_cap"
              ],
              "align": "center"
            },
            {
              "id": "asset_info",
              "component": "Row",
              "children": [
                "asset_icon",
                "asset_name_col"
              ],
              "weight": 2,
              "align": "center"
            },
            {
              "id": "asset_icon",
              "component": "Icon",
              "name": "payment"
            },
            {
              "id": "asset_name_col",
              "component": "Column",
              "children": [
                "asset_name",
                "asset_symbol"
              ]
            },
            {
              "id": "asset_name",
              "component": "Text",
              "text": {
                "@path": "name"
              },
              "variant": "body"
            },
            {
              "id": "asset_symbol",
              "component": "Text",
              "text": {
                "@path": "symbol"
              },
              "variant": "caption"
            },
            {
              "id": "asset_price",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "price"
                  },
                  "currency": "USD"
                }
              },
              "weight": 1
            },
            {
              "id": "asset_change",
              "component": "Text",
              "text": {
                "@call": "formatString",
                "args": {
                  "value": "${change}%"
                }
              },
              "weight": 1
            },
            {
              "id": "asset_market_cap",
              "component": "Text",
              "text": {
                "@call": "formatCurrency",
                "args": {
                  "value": {
                    "@path": "marketCap"
                  },
                  "currency": "USD"
                }
              },
              "weight": 1.5
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-financial-grid",
          "value": {
            "assets": [
              {
                "name": "Bitcoin",
                "symbol": "BTC",
                "price": 43500.25,
                "change": 1.2,
                "marketCap": 850000000000
              },
              {
                "name": "Ethereum",
                "symbol": "ETH",
                "price": 2250.5,
                "change": -0.5,
                "marketCap": 270000000000
              },
              {
                "name": "Solana",
                "symbol": "SOL",
                "price": 95.8,
                "change": 5.4,
                "marketCap": 40000000000
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "34_child-list-template.json",
    "name": "ChildList Template Expansion",
    "description": "Demonstrates dynamic list generation using ChildList object templates.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-child-list-template",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-child-list-template",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "title_text",
                "item_list"
              ],
              "align": "stretch"
            },
            {
              "id": "title_text",
              "component": "Text",
              "text": "### Dynamic Item List"
            },
            {
              "id": "item_list",
              "component": "List",
              "children": {
                "componentId": "item_row",
                "path": "/items"
              }
            },
            {
              "id": "item_row",
              "component": "Row",
              "children": [
                "item_name",
                "qty_label",
                "item_qty"
              ]
            },
            {
              "id": "item_name",
              "component": "Text",
              "text": {
                "@path": "name"
              }
            },
            {
              "id": "qty_label",
              "component": "Text",
              "text": " - Qty: "
            },
            {
              "id": "item_qty",
              "component": "Text",
              "text": {
                "@path": "quantity"
              }
            }
          ]
        }
      },
      {
        "version": "v1.0",
        "updateDataModel": {
          "surfaceId": "gallery-child-list-template",
          "value": {
            "items": [
              {
                "name": "Apple",
                "quantity": 10
              },
              {
                "name": "Banana",
                "quantity": 5
              },
              {
                "name": "Cherry",
                "quantity": 20
              }
            ]
          }
        }
      }
    ]
  },
  {
    "file": "35_markdown-text.json",
    "name": "Markdown Text Support",
    "description": "Demonstrates Markdown rendering in Text component.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "gallery-markdown-text",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "gallery-markdown-text",
          "components": [
            {
              "id": "root",
              "component": "Card",
              "child": "main_column"
            },
            {
              "id": "main_column",
              "component": "Column",
              "children": [
                "title_text",
                "markdown_content"
              ],
              "align": "stretch"
            },
            {
              "id": "title_text",
              "component": "Text",
              "text": "### Markdown Rendering"
            },
            {
              "id": "markdown_content",
              "component": "Text",
              "text": "# Heading 1\n\nThis is **bold** text and *italic* text.\n\n- List item 1\n- List item 2\n\n[Link to Google](https://google.com)"
            }
          ]
        }
      }
    ]
  },
  {
    "file": "36_modal.json",
    "name": "Modal Sample",
    "description": "Example of Modal component showing a trigger and content.",
    "messages": [
      {
        "version": "v1.0",
        "createSurface": {
          "surfaceId": "modal-sample-surface",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "sendDataModel": true
        }
      },
      {
        "version": "v1.0",
        "updateComponents": {
          "surfaceId": "modal-sample-surface",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "children": [
                "title",
                "modal_comp"
              ]
            },
            {
              "id": "title",
              "component": "Text",
              "text": "## Modal Component Sample"
            },
            {
              "id": "modal_comp",
              "component": "Modal",
              "trigger": "open_btn",
              "content": "modal_content"
            },
            {
              "id": "open_btn_text",
              "component": "Text",
              "text": "Open Modal"
            },
            {
              "id": "open_btn",
              "component": "Button",
              "child": "open_btn_text",
              "action": {
                "event": {
                  "name": "openModalEvent",
                  "context": {}
                }
              }
            },
            {
              "id": "modal_content",
              "component": "Column",
              "children": [
                "modal_text"
              ]
            },
            {
              "id": "modal_text",
              "component": "Text",
              "text": "This is the content inside the modal."
            }
          ]
        }
      }
    ]
  }
];
