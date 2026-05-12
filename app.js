
var createEditor = function() {
    var lsKey = "elevatorCrushCode_v5";
    var monacoEditor = null;
    var monacoModel = null;
    var textarea = document.getElementById("code");
    var editorElement = document.getElementById("code_editor");
    var elevatorSagaTypeDefinitions = [
        "type Direction = \"up\" | \"down\" | \"stopped\";",
        "type MovingDirection = \"up\" | \"down\";",
        "",
        "interface Elevator {",
        "    destinationQueue: number[];",
        "    checkDestinationQueue(): void;",
        "    goToFloor(floorNum: number, forceNow?: boolean): void;",
        "    stop(): void;",
        "    currentFloor(): number;",
        "    goingUpIndicator(): boolean;",
        "    goingUpIndicator(value: boolean): Elevator;",
        "    goingDownIndicator(): boolean;",
        "    goingDownIndicator(value: boolean): Elevator;",
        "    maxPassengerCount(): number;",
        "    loadFactor(): number;",
        "    destinationDirection(): Direction;",
        "    getPressedFloors(): number[];",
        "    on(event: \"idle\", callback: () => void): void;",
        "    on(event: \"floor_button_pressed\", callback: (floorNum: number) => void): void;",
        "    on(event: \"passing_floor\", callback: (floorNum: number, direction: MovingDirection) => void): void;",
        "    on(event: \"stopped_at_floor\", callback: (floorNum: number) => void): void;",
        "}",
        "",
        "interface Floor {",
        "    floorNum(): number;",
        "    on(event: \"up_button_pressed\" | \"down_button_pressed\", callback: () => void): void;",
        "}",
        "",
        "interface UserCode {",
        "    init(elevators: Elevator[], floors: Floor[]): void;",
        "    update(dt: number, elevators: Elevator[], floors: Floor[]): void;",
        "}",
        "",
        "declare const _: any;"
    ].join("\n");

    var returnObj = riot.observable({});

    var getCodeValue = function() {
        return monacoEditor ? monacoEditor.getValue() : (textarea.value || "");
    };

    var setCodeValue = function(code) {
        if(monacoEditor) {
            monacoEditor.setValue(code);
        } else {
            textarea.value = code;
        }
    };

    var focusEditor = function() {
        if(monacoEditor) {
            monacoEditor.focus();
        }
    };

    var transpileTypeScript = function(code) {
        if(!window.ts || !window.ts.transpileModule) {
            throw new Error("TypeScript compiler failed to load");
        }
        var trimmedCode = code.trim();
        var sourceForTranspile = trimmedCode;

        if(trimmedCode.substr(0, 1) === "{" && trimmedCode.substr(-1, 1) === "}") {
            sourceForTranspile = "(" + trimmedCode + ")";
        }

        var transpiled = window.ts.transpileModule(sourceForTranspile, {
            compilerOptions: {
                target: window.ts.ScriptTarget.ES5,
                module: window.ts.ModuleKind.None,
                noImplicitUseStrict: true
            }
        }).outputText;

        transpiled = transpiled.replace(/^\s*["']use strict["'];?\s*/i, "");
        transpiled = transpiled.replace(/;\s*$/, "");
        return transpiled;
    };

    var getDefaultImplementation = function() {
        return $("#default-elev-implementation-ts").text().trim();
    };

    var reset = function() {
        setCodeValue(getDefaultImplementation());
    };

    var existingCode = localStorage.getItem(lsKey);
    if(existingCode) {
        setCodeValue(existingCode);
    } else {
        reset();
    }

    var saveCode = function() {
        localStorage.setItem(lsKey, getCodeValue());
        $("#save_message").text("Code saved " + new Date().toTimeString());
        returnObj.trigger("change");
    };

    var autoSaver = _.debounce(saveCode, 1000);

    $("#button_save").click(function() {
        saveCode();
        focusEditor();
    });

    $("#button_reset").click(function() {
        if(confirm("Do you really want to reset to the default implementation?")) {
            localStorage.setItem("develevateBackupCode", getCodeValue());
            reset();
            autoSaver();
        }
        focusEditor();
    });

    $("#button_resetundo").click(function() {
        if(confirm("Do you want to bring back the code as before the last reset?")) {
            setCodeValue(localStorage.getItem("develevateBackupCode") || "");
            autoSaver();
        }
        focusEditor();
    });

    if(window.require && editorElement) {
        window.MonacoEnvironment = {
            getWorkerUrl: function() {
                var workerScript = "self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' };" +
                    "importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/worker/workerMain.js');";
                return "data:text/javascript;charset=utf-8," + encodeURIComponent(workerScript);
            }
        };
        window.require.config({
            paths: {
                vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs"
            }
        });
        window.require(["vs/editor/editor.main"], function() {
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES5,
                module: monaco.languages.typescript.ModuleKind.None,
                allowNonTsExtensions: true,
                noEmitOnError: false
            });
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false
            });
            monaco.languages.typescript.typescriptDefaults.addExtraLib(elevatorSagaTypeDefinitions, "ts:elevatorsaga-api.d.ts");

            monacoEditor = monaco.editor.create(editorElement, {
                value: getCodeValue(),
                language: "typescript",
                theme: "vs-dark",
                automaticLayout: true,
                fontSize: 14,
                tabSize: 4,
                insertSpaces: true,
                minimap: { enabled: false }
            });
            monacoModel = monacoEditor.getModel();
            monaco.editor.setModelLanguage(monacoModel, "typescript");
            monacoEditor.onDidChangeModelContent(function() {
                autoSaver();
            });
            returnObj.trigger("ready");
        });
    } else {
        returnObj.trigger("usercode_error", new Error("Monaco loader did not initialize"));
    }

    returnObj.getCodeObj = function() {
        console.log("Getting code...");
        var code = getCodeValue();
        var runnableCode = transpileTypeScript(code);
        var obj;
        try {
            obj = getCodeObjFromCode(runnableCode);
            returnObj.trigger("code_success");
        } catch(e) {
            returnObj.trigger("usercode_error", e);
            return null;
        }
        return obj;
    };
    returnObj.setCode = function(code) {
        setCodeValue(code);
    };
    returnObj.getCode = function() {
        return getCodeValue();
    }
    returnObj.setDevTestCode = function() {
        setCodeValue($("#devtest-elev-implementation").text().trim());
    }

    $("#button_apply").click(function() {
        returnObj.trigger("apply_code");
    });
    return returnObj;
};


var createParamsUrl = function(current, overrides) {
    return "#" + _.map(_.merge(current, overrides), function(val, key) {
        return key + "=" + val;
    }).join(",");
};



$(function() {
    var tsKey = "elevatorTimeScale";
    var editor = createEditor();

    var params = {};

    var $world = $(".innerworld");
    var $stats = $(".statscontainer");
    var $feedback = $(".feedbackcontainer");
    var $challenge = $(".challenge");
    var $codestatus = $(".codestatus");

    var floorTempl = document.getElementById("floor-template").innerHTML.trim();
    var elevatorTempl = document.getElementById("elevator-template").innerHTML.trim();
    var elevatorButtonTempl = document.getElementById("elevatorbutton-template").innerHTML.trim();
    var userTempl = document.getElementById("user-template").innerHTML.trim();
    var challengeTempl = document.getElementById("challenge-template").innerHTML.trim();
    var feedbackTempl = document.getElementById("feedback-template").innerHTML.trim();
    var codeStatusTempl = document.getElementById("codestatus-template").innerHTML.trim();

    var app = riot.observable({});
    app.worldController = createWorldController(1.0 / 60.0);
    app.worldController.on("usercode_error", function(e) {
        console.log("World raised code error", e);
        editor.trigger("usercode_error", e);
    });

    console.log(app.worldController);
    app.worldCreator = createWorldCreator();
    app.world = undefined;

    app.currentChallengeIndex = 0;

    app.startStopOrRestart = function() {
        if(app.world.challengeEnded) {
            app.startChallenge(app.currentChallengeIndex);
        } else {
            app.worldController.setPaused(!app.worldController.isPaused);
        }
    };

    app.startChallenge = function(challengeIndex, autoStart) {
        if(typeof app.world !== "undefined") {
            app.world.unWind();
            // TODO: Investigate if memory leaks happen here
        }
        app.currentChallengeIndex = challengeIndex;
        app.world = app.worldCreator.createWorld(challenges[challengeIndex].options);
        window.world = app.world;

        clearAll([$world, $feedback]);
        presentStats($stats, app.world);
        presentChallenge($challenge, challenges[challengeIndex], app, app.world, app.worldController, challengeIndex + 1, challengeTempl);
        presentWorld($world, app.world, floorTempl, elevatorTempl, elevatorButtonTempl, userTempl);

        app.worldController.on("timescale_changed", function() {
            localStorage.setItem(tsKey, app.worldController.timeScale);
            presentChallenge($challenge, challenges[challengeIndex], app, app.world, app.worldController, challengeIndex + 1, challengeTempl);
        });

        app.world.on("stats_changed", function() {
            var challengeStatus = challenges[challengeIndex].condition.evaluate(app.world);
            if(challengeStatus !== null) {
                app.world.challengeEnded = true;
                app.worldController.setPaused(true);
                if(challengeStatus) {
                    presentFeedback($feedback, feedbackTempl, app.world, "Success!", "Challenge completed", createParamsUrl(params, { challenge: (challengeIndex + 2)}));
                } else {
                    presentFeedback($feedback, feedbackTempl, app.world, "Challenge failed", "Maybe your program needs an improvement?", "");
                }
            }
        });

        var codeObj = editor.getCodeObj();
        console.log("Starting...");
        app.worldController.start(app.world, codeObj, window.requestAnimationFrame, autoStart);
    };

    editor.on("apply_code", function() {
        app.startChallenge(app.currentChallengeIndex, true);
    });
    editor.on("code_success", function() {
        presentCodeStatus($codestatus, codeStatusTempl);
    });
    editor.on("usercode_error", function(error) {
        presentCodeStatus($codestatus, codeStatusTempl, error);
    });
    editor.on("change", function() {
        $("#fitness_message").addClass("faded");
        var codeStr = editor.getCode();
        // fitnessSuite(codeStr, true, function(results) {
        //     var message = "";
        //     if(!results.error) {
        //         message = "Fitness avg wait times: " + _.map(results, function(r){ return r.options.description + ": " + r.result.avgWaitTime.toPrecision(3) + "s" }).join("&nbsp&nbsp&nbsp");
        //     } else {
        //         message = "Could not compute fitness due to error: " + results.error;
        //     }
        //     $("#fitness_message").html(message).removeClass("faded");
        // });
    });
    editor.trigger("change");

    riot.route(function(path) {
        params = _.reduce(path.split(","), function(result, p) {
            var match = p.match(/(\w+)=(\w+$)/);
            if(match) { result[match[1]] = match[2]; } return result;
        }, {});
        var requestedChallenge = 0;
        var autoStart = false;
        var timeScale = parseFloat(localStorage.getItem(tsKey)) || 2.0;
        _.each(params, function(val, key) {
            if(key === "challenge") {
                requestedChallenge = _.parseInt(val) - 1;
                if(requestedChallenge < 0 || requestedChallenge >= challenges.length) {
                    console.log("Invalid challenge index", requestedChallenge);
                    console.log("Defaulting to first challenge");
                    requestedChallenge = 0;
                }
            } else if(key === "autostart") {
                autoStart = val === "false" ? false : true;
            } else if(key === "timescale") {
                timeScale = parseFloat(val);
            } else if(key === "devtest") {
                editor.setDevTestCode();
            } else if(key === "fullscreen") {
                makeDemoFullscreen();
            }
        });
        app.worldController.setTimeScale(timeScale);
        app.startChallenge(requestedChallenge, autoStart);
    });
});
