{
  maxFloor: 0,
  time: 0,
  _elevators: [],
  _floors: [],

  /**
   * @param elevator
   * @param fromFloorNum
   * @param toFloorNum
   */
  elevatorHighlightWhileMove: function(elevator, fromFloorNum, toFloorNum){
    if (toFloorNum > fromFloorNum) {
      // going up
      elevator.goingUpIndicator(true).goingDownIndicator(false);
      return 'up';
    }
    else if (toFloorNum < fromFloorNum){
      // going down
      elevator.goingUpIndicator(false).goingDownIndicator(true);
      return 'down';
    }
    else {// current - we mark as stop
      elevator.goingUpIndicator(false).goingDownIndicator(false);
      return 'none';
    }
  },

  /**
   * @param elevator
   * @param floorNum
   */
  elevatorMoveFromInside: function (elevator, floorNum) {
    var currentFloor = elevator.currentFloor();
    this.elevatorHighlightWhileMove(elevator, currentFloor, floorNum);
    // console.log("floor button pressed inside the elevator. Moving from " + currentFloor + " to " + floorNum);
    elevator.goToFloor(floorNum);
  },

  /**
   * @param elevator
   * @param floor
   * @returns string
   */
  elevatorHighlightWhileStoppedAtFloor: function (elevator, floor) {
    var floorNum = floor.floorNum();
    if (floorNum == 0) {
      // first floor
      elevator.goingUpIndicator(true).goingDownIndicator(false);
      return 'up';
    }
    else if (floorNum == this.maxFloor) {
      // last floor
      elevator.goingUpIndicator(false).goingDownIndicator(true);
      return 'down';
    }
    else{// middle floors
      // here can be only people who want to move up, or only down, all both.
      // if will take both, elevator can be used not for 100%
      // also here can appear most of bugs, so this place is important
      if ( floor.requestedDown && floor.requestedUp ){
        // if 0 floor is closer - move there
        if ( this.maxFloor / 2 > floorNum ){
          elevator.goingUpIndicator(false).goingDownIndicator(true);
          return 'down';
        }
        else {
          elevator.goingUpIndicator(true).goingDownIndicator(false);
          return 'up';
        }
      }
      // else is not allowed - if we highligh both so any can enter (even if all want to go in one direction),
      // can be so that while all passengers comes to elevator, a new one creates with another direction,
      // so need to use endif
      else if (floor.requestedDown && !floor.requestedUp) {
        elevator.goingUpIndicator(false).goingDownIndicator(true);
        return 'down';
      }
      else if (floor.requestedUp && !floor.requestedDown) {
        elevator.goingUpIndicator(true).goingDownIndicator(false);
        return 'up';
      }
      else {
        // noboby
        elevator.goingUpIndicator(true).goingDownIndicator(true);
        return 'both';
      }
    }
  },

  sendEmptyElevatorToFloor: function (elevator, floorNum) {
    if (elevator.loadFactor() < 0.05) {
      var currentFloor = elevator.currentFloor();
      // console.log("Sending empty elevator from floor " + currentFloor + " to floor " + floorNum);
      var highlightedDirection = this.elevatorHighlightWhileMove(elevator, currentFloor, floorNum);
      elevator.direction = highlightedDirection == 'none' ? 'stop' : highlightedDirection;
      elevator.moveToFloorNum = highlightedDirection == 'none' ? currentFloor : floorNum;
      elevator.goToFloor(floorNum, true);
    }
    else
      console.error('Elevator is not empty. Load factor: ' + elevator.loadFactor());
  },

  elevatorIdle: function(elevator, floors){
    var o = this;
    floors.forEach(function(floor){
      if (floor.requestedDown || floor.requestedUp)
        o.sendEmptyElevatorToFloor(elevator, floor.floorNum());
    })
  },

  isElevatorIdle: function(elevator){
    return elevator.loadFactor() == 0 &&
      elevator.direction == 'stop' &&
      elevator.moveToFloorNum == elevator.currentFloor();
  },

  checkForElevatorsIdle: function(){
    var o = this;
    // as no breal in forEach, will use some
    this._elevators.some(function(elevator){
      if ( o.isElevatorIdle(elevator) )
        elevator.trigger('idle');
    });
  },

  init: function (elevators, floors) {
    this.maxFloor = floors.length - 1;
    this._elevators = elevators;
    this._floors = floors;
    var o = this;

    // Prepare floors
    floors.forEach(function(floor) {
      floor.requestedUp = floor.requestedDown = false;
      floor
        .on("up_button_pressed", function() {
          floor.requestedUp = true;
          // if no elevators moving there - find a free one
          var movingThere = elevators.some(function(elevator){
            elevator.moveToFloorNum == floor.floorNum();
          });
          if ( !movingThere )
            o.checkForElevatorsIdle();
        })
        .on("down_button_pressed", function() {
          floor.requestedDown = true;
          // if no elevators moving there - find a free one
          var movingThere = elevators.some(function(elevator){
            elevator.moveToFloorNum == floor.floorNum();
          });
          if ( !movingThere )
            o.checkForElevatorsIdle();
        });
    });

    // Prepare elevators
    elevators.forEach(function(elevator, idx) {
      elevator.idx = idx;
      elevator.maxPassenger = elevator.maxPassengerCount();
      elevator.direction = 'stop';
      elevator.moveToFloorNum = 0;
    });

    elevators.forEach(function(elevator){
      elevator
        .on("floor_button_pressed", function (floorNum) {
          if (elevator.direction == 'stop'){
            elevator.direction = (floorNum > elevator.currentFloor()) ? 'up' : elevator.direction = 'down';
            elevator.moveToFloorNum = floorNum;
            o.elevatorMoveFromInside(elevator, elevator.moveToFloorNum);
          }
          else if (
            (elevator.direction == 'up' && elevator.moveToFloorNum < floorNum) ||
            (elevator.direction == 'down' && elevator.moveToFloorNum > floorNum)
          ){
            elevator.moveToFloorNum = floorNum;
            o.elevatorMoveFromInside(elevator, elevator.moveToFloorNum);
          }
        })

        .on("stopped_at_floor", function (floorNum) {
          if (elevator.moveToFloorNum == floorNum){
            elevator.direction = 'stop';
            var highlightedDirection = o.elevatorHighlightWhileStoppedAtFloor(elevator, floors[floorNum]);
            if (highlightedDirection == 'both'){
              floors[floorNum].requestedDown = false;
              floors[floorNum].requestedUp = false;
            }
            else if (highlightedDirection == 'up'){
              elevator.direction = highlightedDirection;
              floors[floorNum].requestedUp = false;
            }
            else if (highlightedDirection == 'down'){
              elevator.direction = highlightedDirection;
              floors[floorNum].requestedDown = false;
            }

            // unstuck
            if (elevator.loadFactor() > 0){
              var stuck = elevator.getPressedFloors();
              if (stuck.length){
                console.warn('Stucked levels: ' + stuck.toString());
                elevator.goToFloor(stuck[0]);
              }
            }
          }
        })

        /**
         * Idle rule applies only after elevator stops and became empty.
         * If an empty elevator is doing nothing, and a new passanger will appear,
         * this event will not be triggered automatically
         */
        .on("idle", function () {
          o.elevatorIdle(elevator, floors);
        })

        .on("passing_floor", function(floorNum, direction){
          if ((elevator.maxPassenger > 4 && elevator.loadFactor() < 0.85) || // big elevator come in rule
              (elevator.maxPassenger == 4 && elevator.loadFactor() < 0.76) ||   // small elevator come in rule
              elevator.getPressedFloors().indexOf(floorNum) != -1            // any elevator come out rule
          ){
            // Queue fix
            if (elevator.getPressedFloors().length < elevator.destinationQueue.length){
              elevator.destinationQueue = [];
              elevator.destinationQueue.push(elevator.moveToFloorNum);
            }
            // end of queue fix

            // console.log(o.time + 'Elevator is not full. Moving: ' + direction);
            // console.log(', requested: ' + floors[floorNum].requestedUp ? "up ":"" + floors[floorNum].requestedDown ? "down ":"");
            if (direction == 'up' && floors[floorNum].requestedUp){
              elevator.goToFloor(floorNum, true);
              floors[floorNum].requestedUp = false;
            }
            else if(direction == 'down' && floors[floorNum].requestedDown){
              elevator.goToFloor(floorNum, true);
              floors[floorNum].requestedDown = false;
            }
            else if (elevator.getPressedFloors().indexOf(floorNum) != -1){
              elevator.goToFloor(floorNum, true);
              if (direction == 'up')
                floors[floorNum].requestedUp = false;
              else
                floors[floorNum].requestedDown = false;
            }
          }
        })
      ;
    });
  },

  update: function (dt, elevators, floors) {
    this.time += dt;
  }
}