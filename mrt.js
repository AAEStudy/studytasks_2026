function buildMRTChunk(params){
const subjectID = params.subjectID;
var jsPsych = params.jsPsych;
      // Prevent accidental page unload.
      function handleBeforeUnload(e) {
          e.preventDefault();
          e.returnValue = '';
        };

      // Add the listener using the named function
      window.addEventListener('beforeunload', handleBeforeUnload);
      var jsPsych = params.jsPsych;

      // ---------------- Global Variables & Data Storage ----------------
      //setIDfromlink();
      let trialNum = 0;  
      let probeBlockCounter = 0; //for the instructed response option
      let customData = {
        subject: [],
        trial: [],
        task: [],
        trial_num: [],
        RT_from_metronome: [],
        omission: [],
        performance_rating: [],
        probe1_rt: [],
        probe2_rt: [],
        confidence_rating: [],
        //probe_text: [],
        pause_time: [],
        break_time: [],  // <-- New field for break durations
        instructed_response: []  // New column for instructed-response data
      };
      const lag_time = 650;
      let tempPerformance = null;
      let tempProbeRT1 = null;
      let tempProbeRT2 = null;
      let pause = false;
      let pauseStart = 0;
      let justPaused = false;
      let repeatPractice = false;
      let practiceConsecutiveMisses = 0;
      let mainConsecutiveMisses = 0;
      let practiceLastRT = null;
      let mainLastRT = null;

      // ---------------- Countdown Functions ----------------
      function add_countdown(n, l=1300) {
        return {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: `<p style="font-size: 18pt;">${n}</p>`,
          response_ends_trial: false,
          trial_duration: l,
        };
      }
      function add_countdown_pad() {
        return {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: "",
          response_ends_trial: false,
          on_start: function() { leadup_ticks(); },
          trial_duration: 650
        };
      }
      function leadup_ticks() {
        setTimeout(() => { play_metronome_tick(); }, 650);
        setTimeout(() => { play_metronome_tick(); }, 650 + 1300);
        setTimeout(() => { play_metronome_tick(); }, 650 + 2*1300);
        setTimeout(() => { play_metronome_tick(); }, 650 + 3*1300);
      }

      // ---------------- Data Saving Functions ----------------
      function saveTappingTrial(score, taskType = "metronome") {
        trialNum++;
        customData.subject.push(subjectID);
        customData.trial.push(trialNum);
        customData.task.push(taskType); // will be "practice trial" or "metronome"
        customData.trial_num.push(trialNum);
        customData.RT_from_metronome.push(score);
        customData.omission.push(score === "" ? "TRUE" : "FALSE");
        customData.performance_rating.push("NA");
        customData.probe1_rt.push("NA");
        customData.probe2_rt.push("NA");
        customData.confidence_rating.push("NA");
        //customData.probe_text.push("NA");
        customData.pause_time.push("NA");
        customData.instructed_response.push("NA"); // Not applicable for tapping trials
      }
      function saveThoughtProbeTrial(confidence) {
        trialNum++;
        let probeText = (tempPerformance > 3) ? "On Task" : "Confident";
        customData.subject.push(subjectID);
        customData.trial.push(trialNum);
        customData.task.push("thought_probe");
        customData.trial_num.push(trialNum);
        customData.RT_from_metronome.push("NA");
        customData.omission.push("FALSE");
        customData.performance_rating.push(tempPerformance);
        customData.probe1_rt.push(tempProbeRT1);
        customData.probe2_rt.push(tempProbeRT2);
        customData.confidence_rating.push(confidence);
        customData.instructed_response.push("NA");
        //customData.instructed_response.push("instructed_response"); 
        //customData.probe_text.push(probeText);
        customData.pause_time.push("NA");
        tempPerformance = null;
        tempProbeRT1 = null;
        tempProbeRT2 = null;
      }
      function savePauseTrial(pauseDuration) {
        trialNum++;
        customData.subject.push(subjectID);
        customData.trial.push(trialNum);
        customData.task.push("pause");
        customData.trial_num.push(trialNum);
        customData.RT_from_metronome.push("NA");
        customData.omission.push("pause");
        customData.performance_rating.push("NA");
        customData.probe1_rt.push("NA");
        customData.probe2_rt.push("NA");
        customData.confidence_rating.push("NA");
        //customData.probe_text.push("NA");
        customData.pause_time.push(pauseDuration.toFixed(3));
        customData.instructed_response.push("NA"); // Not applicable for pause trial
      }
      function convertToCSV(dataObj) {
        let columns = Object.keys(dataObj);
        let header = columns.join("\t") + "\n";
        let numRows = dataObj[columns[0]].length;
        let rows = [];
        for (let i = 0; i < numRows; i++) {
          let row = columns.map(col => dataObj[col][i]);
          rows.push(row.join("\t"));
        }
        return header + rows.join("\n");
      }
      function play_metronome_tick() {
        metronomeAudio.currentTime = 0;
        metronomeAudio.play();
      }

      // ---------------- Pause Functionality ----------------
      let pause_trial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<p style='text-align:center;font-size:100px;'>⏸️</p>
                     <p style='text-align:center;'>Press <strong>[P]</strong> to continue.</p>`,
        choices: ["p"],
        response_ends_trial: true,
        trial_duration: null,
        on_start: function() {
          pauseStart = performance.now();
        },
        on_finish: function() {
          pause = false;
          justPaused = true;
          let pauseEnd = performance.now();
          let pauseSec = (pauseEnd - pauseStart) / 1000;
          savePauseTrial(pauseSec);
        }
      };
      let pause_node = {
        timeline: [pause_trial],
        conditional_function: function() { return pause; }
      };

      // ---------------- PRACTICE TAPPING ----------------
      let practice_tapping_main = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: "",
        choices: [" ", "p"],
        response_ends_trial: true,
        trial_duration: 1300,
        on_start: function() {
          setTimeout(() => { play_metronome_tick(); }, 650);
        },
        on_finish: function(data) {
          if(data.response === "p") {
            pause = true;
            practiceLastRT = null; 
          } else if(data.response === " ") {
            practiceLastRT = data.rt;
          } else {
            practiceLastRT = null;
          }
        }
      };
      let practice_tapping_pad = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function() {
          if(practiceLastRT === null) {
            return "";
          }
          return '<div class="plus">+</div>';
        },
        choices: [" "],
        response_ends_trial: false,
        trial_duration: function() {
          if(practiceLastRT === null) {
            return 0;
          }
          let leftover = 1300 - practiceLastRT;
          return leftover > 0 ? leftover : 0;
        },
        on_finish: function() {
          if (pause || justPaused) {
            justPaused = false;
            return;
          }
          if(practiceLastRT === null) {
            saveTappingTrial("", "practice trial");
            practiceConsecutiveMisses++;
          } else {
            let score = practiceLastRT - lag_time;
            saveTappingTrial(score, "practice trial");
            practiceConsecutiveMisses = 0;
          }
        }
      };
      let practice_pad_node = {
        timeline: [practice_tapping_pad],
        conditional_function: function() {
          return !pause;
        }
      };

      let practice_tapping_trial = {
        timeline: [practice_tapping_main, pause_node, practice_pad_node]
      };

      let break_trial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <p style="color:white; font-size:20pt; text-align:left;">
            You have finished the first half of this task. Nice job!<br><br>
            You may now take a short break (up to 2-3 mins max) to use the bathroom, stand up, stretch, etc. if needed.
          </p>
          <p style="color:white; text-align:center;">
            You have a little over 10 minutes left.
            Press SPACE to continue with the second half of this task.
          </p>
        `,
        choices: [" "],
        on_start: function() {
          // Record the break start time (using a global variable or within the trial data)
          window.breakStartTime = performance.now();
        },
        on_finish: function(data) {
          // Calculate the break duration in seconds
          let breakDuration = (performance.now() - window.breakStartTime) / 1000;
          // Attach break duration to this trial’s data if you like
          data.break_duration = breakDuration;
          // And record it in your customData object
          customData.break_time.push(breakDuration.toFixed(3));
        }
      };


      let practice_miss_node = {
        timeline: [
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: "<p>You haven't pressed SPACE for the last 4 trials.<br>Remember to press SPACE in time with the metronome.<br><br>Press SPACE to continue.</p>",
            choices: [" "],
            on_finish: function() {
              practiceConsecutiveMisses = 0;
            }
          }
        ],
        conditional_function: function() {
          return practiceConsecutiveMisses >= 4;
        }
      };
      const numPracticeTrials = 30;
      let practice_trial_counter = 0;
      let practice_block = {
        timeline: [
          {
            timeline: [practice_tapping_trial, practice_miss_node],
            loop_function: function() {
              practice_trial_counter++;
              return (practice_trial_counter < numPracticeTrials);
            }
          }
        ]
      };
      let practice_prompt = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: "<p>The practice trials are now over.<br><br>If you would like to redo the practice trials, press <strong>[Left Arrow]</strong>.<br><br>If you are ready to begin the main experiment, press <strong>[Right Arrow]</strong>.</p>",
        choices: ["arrowleft", "arrowright"],
        on_finish: function(data) {
          if(data.response === "arrowleft") {
            repeatPractice = true;
            practice_trial_counter = 0;
            trialNum = 0;
            practiceConsecutiveMisses = 0;
          } else {
            repeatPractice = false;
          }
        }
      };
      let practice_node = {
        timeline: [practice_block, practice_prompt],
        loop_function: function() { return repeatPractice; }
      };
      let instructed_response_trial = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="text-align: center; color: white;">
                  <!-- Wrap the question text in the same container -->
                  <div style="display: inline-block; white-space: nowrap; width: 1050px; text-align: left; margin-bottom: 50px;">
                    <p style="font-size: 20pt; margin: 0;">
                      3. Select option six so we can ensure the quality of your responses.
                      </p>
                  </div>
                  <!-- The response options container -->
                  <div style="display: inline-block; width: 1050px; margin-top: 100px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                          <div style="width: 150px; text-align: center; font-size:20pt;">Least on Task</div>
                          <div style="width: 225px;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt; display: flex; align-items: center; justify-content: center">Middle</div>
                          <div style="width: 225px;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">Most on Task</div>
                      </div>
                      <div style="display: flex; justify-content: space-evenly; align-items: center;">
                          <div style="width: 150px; text-align: center; font-size:20pt;">[1]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[2]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[3]</div>
                          <div style="width: 71.5px; text-align: center; font-size:20pt;"></div>
                          <div style="width: 2px; height: 25px; background-color: white;"></div>
                          <div style="width: 71.5px; text-align: center; font-size:20pt;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[4]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[5]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[6]</div>
                      </div>
                      <div style="display: flex; justify-content: center; margin-top: 150px;">
                          <div style="width: 600px; text-align: center; font-size:16pt;">
                            Please choose the instructed option so that we can ensure quality responses are being given. Press a key (1–6) for your response.</div>
                      </div>
                  </div>
                </div>`,
            choices: ["1", "2", "3", "4", "5", "6"],
            data: { instructed_response_probe: 1 },
            on_finish: function(data) {
              
              // 1) Increment your trial counter
              trialNum++;
              // 2) Add a row to customData with the actual response
              customData.subject.push(subjectID);
              customData.trial.push(trialNum);
              customData.task.push("instructed_response");
              customData.trial_num.push(trialNum);

              // Usually no tapping data for this trial:
              customData.RT_from_metronome.push("NA");
              customData.omission.push("FALSE");

              // Not a probe or pause, so push "NA" for those:
              customData.performance_rating.push("NA");
              customData.probe1_rt.push("NA");
              customData.probe2_rt.push("NA");
              customData.confidence_rating.push("NA");
              customData.pause_time.push("NA");

              // The key line: push the actual response
              customData.instructed_response.push(data.response);
            }
          };
      let main_miss_node = {
        timeline: [{
          type: jsPsychHtmlKeyboardResponse,
          stimulus: "<p>You haven't pressed SPACE for the last 4 trials.<br>Remember to press SPACE in time with the metronome.<br><br>Press SPACE to continue.</p>",
          choices: [" "],
          on_finish: function() {
            mainConsecutiveMisses = 0;
          }
        }],
        conditional_function: function() {
          return mainConsecutiveMisses >= 4;
        }
      };

      // ---------------- Thought Probe Block ----------------
      let thought_probe_block = {
        timeline: [
          {
            // Small trial to increment the counter for each probe block
            type: jsPsychHtmlKeyboardResponse,
            stimulus: "",
            choices: "NO_KEYS",
            trial_duration: 1,
            on_start: function() {
              probeBlockCounter++;
            }
          },
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="text-align: center; color: white;">
                  <!-- Wrap the question text in the same container -->
                  <div style="display: inline-block; width: 1050px; text-align: left; margin-bottom: 50px;">
                    <p style="font-size: 20pt; margin: 0;">
                      1. How on task were you just before this screen appeared?
                    </p>
                  </div>
                  <!-- The response options container -->
                  <div style="display: inline-block; width: 1050px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px; margin-top: 100px;">
                          <div style="width: 150px; text-align: center; font-size:20pt;">Least on Task</div>
                          <div style="width: 225px;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt; display: flex; align-items: center; justify-content: center">Middle</div>
                          <div style="width: 225px;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">Most on Task</div>
                      </div>
                      <div style="display: flex; justify-content: space-evenly; align-items: center;">
                          <div style="width: 150px; text-align: center; font-size:20pt;">[1]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[2]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[3]</div>
                          <div style="width: 71.5px; text-align: center; font-size:20pt;"></div>
                          <div style="width: 2px; height: 25px; background-color: white;"></div>
                          <div style="width: 71.5px; text-align: center; font-size:20pt;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[4]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[5]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[6]</div>
                      </div>
                      <div style="display: flex; justify-content: center; margin-top: 150px;">
                          <div style="width: 600px; text-align: center; font-size:16pt;">
                              Indicate how focused you were on clicking along to the metronome just before we asked. Press a key (1–6) for your response.
                            </div>
                      </div>
                  </div>
                </div>`,
            choices: ["1", "2", "3", "4", "5", "6"],
            data: { probe_question: 1, thought_probe: 1 },
            on_finish: function(data) {
              tempPerformance = data.response;
              tempProbeRT1 = (data.rt / 1000).toFixed(3);
            }
          },
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                
                <div style="text-align: center; color: white;">
                  <!-- Wrap the question text in the same container -->
                  <div style="display: inline-block; white-space: nowrap; width: 1050px; text-align: left; margin-bottom: 50px;">
                    <p style="font-size: 20pt; margin: 0;">
                      2. How confident are you in the task focus rating you just provided?
                    </p>
                  </div>
                  <!-- The response options container -->
                  <div style="display: inline-block; width: 1050px; margin-top: 100px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                          <div style="width: 150px; text-align: center; font-size:20pt;">Least Confident</div>
                          <div style="width: 225px;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt; display: flex; align-items: center; justify-content: center">Middle</div>
                          <div style="width: 225px;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">Most Confident</div>
                      </div>
                      <div style="display: flex; justify-content: space-evenly; align-items: center;">
                          <div style="width: 150px; text-align: center; font-size:20pt;">[1]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[2]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[3]</div>
                          <div style="width: 71.5px; text-align: center; font-size:20pt;"></div>
                          <div style="width: 2px; height: 25px; background-color: white;"></div>
                          <div style="width: 71.5px; text-align: center; font-size:20pt;"></div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[4]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[5]</div>
                          <div style="width: 150px; text-align: center; font-size:20pt;">[6]</div>
                      </div>
                      <div style="display: flex; justify-content: center; margin-top: 150px;">
                          <div style="width: 600px; text-align: center; font-size:16pt;">
                            Indicate how certain you are your prior response accurately reflects how focused you were. Press a key (1–6) for your response.</div>
                      </div>
                  </div>
                </div>`,
            choices: ["1", "2", "3", "4", "5", "6"],
            data: { probe_question: 2, thought_probe: 1 },
            on_finish: function(data) {
              tempProbeRT2 = (data.rt / 1000).toFixed(3);
              saveThoughtProbeTrial(data.response);
            }
          },
                // Conditionally include the instructed-response trial as the third question,
          // but only on every 10th probe block.
          {
            timeline: [instructed_response_trial],
            conditional_function: function() {
              return (probeBlockCounter % 10 === 0);//only occurs when trial count is divisible by 10, so it occurs on every 10th block.
            }
          },
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `<p style="font-size:24pt; text-align:center;">Press the spacebar to continue and resume clicking along to the metronome.</p>`,
            choices: [" "]
          },
          {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: "",
            choices: [" "],
            trial_duration: 650,
            prompt: "<img src='images/sound-icon.png'>",
            response_ends_trial: false,
            data: { thought_probe: 1 }
          }
        ]
      };
      let tapping_main = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: "", 
        choices: [" ", "p"],
        response_ends_trial: true,
        trial_duration: 1300,
        on_start: function() {
          setTimeout(() => { play_metronome_tick(); }, 650);
        },
        on_finish: function(data) {
          if(data.response === "p") {
            pause = true;
            mainLastRT = null;
          } else if(data.response === " ") {
            mainLastRT = data.rt;
          } else {
            mainLastRT = null;
          }
        }
      };
      let tapping_pad = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function() {
          if(mainLastRT === null) {
            return "";
          }
          return '<div class="plus">+</div>';
        },
        choices: [" "],
        response_ends_trial: false,
        trial_duration: function() {
          if(mainLastRT === null) {
            return 0;
          }
          let leftover = 1300 - mainLastRT;
          return leftover > 0 ? leftover : 0;
        },
        on_finish: function() {
          if (pause || justPaused) {
            justPaused = false;
            return;
          }
          if(mainLastRT === null) {
            saveTappingTrial("");
            mainConsecutiveMisses++; // Increment counter on a no response
          } else {
            let score = mainLastRT - lag_time;
            saveTappingTrial(score);
            mainConsecutiveMisses = 0;  // Reset counter on a valid response
          }
        }
      };
      let main_pad_node = {
        timeline: [tapping_pad],
        conditional_function: function() {
          return !pause;
        }
      };
      let tapping_trial = {
        timeline: [tapping_main, pause_node, main_pad_node]
      };
      let countdown_main = [
        add_countdown("Main trials starting in 3..."),
        add_countdown("Main trials starting in 2..."),
        add_countdown("Main trials starting in 1..."),
        add_countdown("Go!", 650)
      ];
      function generateJitteredIntervals(numBlocks, baseTime, jitterRange) {
        let jitters = [];
        for (let i = 0; i < numBlocks; i++) {
          jitters.push(Math.random() * 2 * jitterRange - jitterRange);
        }
        const sumJitters = jitters.reduce((acc, val) => acc + val, 0);
        const avgJitter = sumJitters / numBlocks;
        const adjustedJitters = jitters.map(x => x - avgJitter);
        return adjustedJitters.map(j => baseTime + j);
      }
      
      
      // ---- Build MRT blocks so we can interleave with meta-emotion calibration ----
      // Each block ends with the same thought-probe + confidence sequence as the original task.
      let mrt_blocks = [];
      const numBlocks = (params.numBlocks !== undefined) ? params.numBlocks : 2; //35 was original number
      const baseTime = 40;
      const jitterRange = 15;

      const intervals = generateJitteredIntervals(numBlocks, baseTime, jitterRange);

      for (let i = 0; i < numBlocks; i++) {
        let blockTimeline = [];
        let intervalSeconds = intervals[i];
        let nTappingTrials = Math.round((intervalSeconds * 1000) / 1300);

        for (let j = 0; j < nTappingTrials; j++) {
          blockTimeline.push(tapping_trial);
          blockTimeline.push(main_miss_node);
        }

        blockTimeline.push(thought_probe_block);

        if ((params.includeMidBreak !== false) && (i === Math.ceil(numBlocks / 2) - 1)) {
          blockTimeline.push(break_trial);
          blockTimeline.push(add_countdown_pad());
          blockTimeline = blockTimeline.concat(countdown_main);
        }

        mrt_blocks.push(blockTimeline);
      }

      // Cursor used to resume MRT blocks after switching away
      if (params._state.mrtCursor === undefined) params._state.mrtCursor = 0;

      function takeMrtBlocks(nBlocks){
        const out = [];
        for (let k = 0; k < nBlocks && params._state.mrtCursor < mrt_blocks.length; k++) {
          out.push(...mrt_blocks[params._state.mrtCursor]);
          params._state.mrtCursor += 1;
        }
        return out;
      }

      // Build the MRT portion requested for this call
      // Build the MRT portion requested for this call
      const blocksToTake = params.blocksToTake ?? mrt_blocks.length;
      const mrt_main = takeMrtBlocks(blocksToTake);

      let timeline = [];
      timeline = timeline.concat(mrt_main);

      // 6. Save data
      // timeline.push(osfSaveData); // handled by main pipeline

      // 7. Demographic survey
      // timeline.push(demographics);

      // 8. Debrief (IMPORTANT: don't include debrief in every chunk; see note below)
      // timeline.push(debrief);

return { timeline, customData, convertToCSV, getSubjectID: ()=>subjectID };
      
    
}
