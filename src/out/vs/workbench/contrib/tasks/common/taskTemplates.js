import * as nls from "../../../../nls.js";
const dotnetBuild = {
  id: "dotnetCore",
  label: ".NET Core",
  sort: "NET Core",
  autoDetect: false,
  description: nls.localize("dotnetCore", "Executes .NET Core build command"),
  content: [
    "{",
    "	// See https://go.microsoft.com/fwlink/?LinkId=733558",
    "	// for the documentation about the tasks.json format",
    '	"version": "2.0.0",',
    '	"tasks": [',
    "		{",
    '			"label": "build",',
    '			"command": "dotnet",',
    '			"type": "shell",',
    '			"args": [',
    '				"build",',
    "				// Ask dotnet build to generate full paths for file names.",
    '				"/property:GenerateFullPaths=true",',
    "				// Do not generate summary otherwise it leads to duplicate errors in Problems panel",
    '				"/consoleloggerparameters:NoSummary"',
    "			],",
    '			"group": "build",',
    '			"presentation": {',
    '				"reveal": "silent"',
    "			},",
    '			"problemMatcher": "$msCompile"',
    "		}",
    "	]",
    "}"
  ].join("\n")
};
const msbuild = {
  id: "msbuild",
  label: "MSBuild",
  autoDetect: false,
  description: nls.localize("msbuild", "Executes the build target"),
  content: [
    "{",
    "	// See https://go.microsoft.com/fwlink/?LinkId=733558",
    "	// for the documentation about the tasks.json format",
    '	"version": "2.0.0",',
    '	"tasks": [',
    "		{",
    '			"label": "build",',
    '			"type": "shell",',
    '			"command": "msbuild",',
    '			"args": [',
    "				// Ask msbuild to generate full paths for file names.",
    '				"/property:GenerateFullPaths=true",',
    '				"/t:build",',
    "				// Do not generate summary otherwise it leads to duplicate errors in Problems panel",
    '				"/consoleloggerparameters:NoSummary"',
    "			],",
    '			"group": "build",',
    '			"presentation": {',
    "				// Reveal the output only if unrecognized errors occur.",
    '				"reveal": "silent"',
    "			},",
    "			// Use the standard MS compiler pattern to detect errors, warnings and infos",
    '			"problemMatcher": "$msCompile"',
    "		}",
    "	]",
    "}"
  ].join("\n")
};
const command = {
  id: "externalCommand",
  label: "Others",
  autoDetect: false,
  description: nls.localize("externalCommand", "Example to run an arbitrary external command"),
  content: [
    "{",
    "	// See https://go.microsoft.com/fwlink/?LinkId=733558",
    "	// for the documentation about the tasks.json format",
    '	"version": "2.0.0",',
    '	"tasks": [',
    "		{",
    '			"label": "echo",',
    '			"type": "shell",',
    '			"command": "echo Hello"',
    "		}",
    "	]",
    "}"
  ].join("\n")
};
const maven = {
  id: "maven",
  label: "maven",
  sort: "MVN",
  autoDetect: false,
  description: nls.localize("Maven", "Executes common maven commands"),
  content: [
    "{",
    "	// See https://go.microsoft.com/fwlink/?LinkId=733558",
    "	// for the documentation about the tasks.json format",
    '	"version": "2.0.0",',
    '	"tasks": [',
    "		{",
    '			"label": "verify",',
    '			"type": "shell",',
    '			"command": "mvn -B verify",',
    '			"group": "build"',
    "		},",
    "		{",
    '			"label": "test",',
    '			"type": "shell",',
    '			"command": "mvn -B test",',
    '			"group": "test"',
    "		}",
    "	]",
    "}"
  ].join("\n")
};
let _templates = null;
function getTemplates() {
  if (!_templates) {
    _templates = [dotnetBuild, msbuild, maven].sort((a, b) => {
      return (a.sort || a.label).localeCompare(b.sort || b.label);
    });
    _templates.push(command);
  }
  return _templates;
}
export {
  getTemplates
};
