import { GetSprite } from "../assets/loader";
import LSystem from 'lindenmayer';
import { GameApp } from './app.ts';
import * as PIXI from "pixi.js";

// https://britonia.wordpress.com/2009/08/23/procedural-road-generation/
export let roadsystem = new LSystem({
      axiom: 'X',
      productions: {
        'X': 'F-[[X]+X]+F[+FX]-X',
        'F': {
          successors: [{weight: 95, successor: 'FF'}, {weight: 5, successor: 'FC'}]
        }
      }
});

export class RoadSystem {
  segments: RoadSegment[];

  constructor(instructions: string, width: number, height: number) {
    let angle = 0.0, x = width/2, y = height/2, roadEnded = false, previousSegment = null;
    this.segments = [];
    let stack = [];
    for (let char of instructions) {
      let deltaX, deltaY, state, newX, newY, segment, culDeSac;
      switch (char) {
        case 'F':
          // forward
          deltaX = 10 * Math.sin(angle);
          deltaY = 10 * Math.cos(angle);
          newX = Math.max(0, Math.min(x + deltaX, width));
          newY = Math.max(0, Math.min(y + deltaY, height));
          if (!roadEnded) {

            segment = new RoadSegment(x, y, newX, newY, previousSegment);
            if (this.segments.some(s => s.overlaps(segment))) {
              segment.destroy();
            } else {
              this.segments.push(segment);
              previousSegment?.nextSegment = segment;
              previousSegment = segment;
            }
          }
          x = newX;
          y = newY;
          break;
        case '-':
          // -pi/2 radians to angle
          angle -= Math.PI/2;
          break;
        case '+':
          // +pi/2 radians to angle
          angle += Math.PI/2;
          break;
        case '[':
          // push position and angle
          stack.push({x, y, angle, roadEnded, previousSegment});
          break;
        case ']':
          // pop position and angle
          if (stack.length === 0) {
            console.error('stack empty');
          }
          state = stack.pop();
          x = state.x;
          y = state.y;
          angle = state.angle;
          roadEnded = state.roadEnded;
          roadEnded = false;
          previousSegment = state.previousSegment;
          break;
        case 'X':
          break;
        case 'C':
          // cul-de-sac
          culDeSac = new PIXI.Graphics();
          culDeSac.beginFill().drawCircle(x, y, 5).endFill();
          GameApp.Stage.addChild(culDeSac);
          // roadEnded = true;
          break;
        default:
          console.warn(`RoadSystem doesn't understand ${char}`);
          break;
      }
    }
    this.segments.forEach(s => {
      s.draw();
      if (!s.previousSegment) {
        let culDeSac = new PIXI.Graphics();
        culDeSac.beginFill().drawCircle(s.start.x, s.start.y, 5).endFill();
        GameApp.Stage.addChild(culDeSac);
      }
      if (!s.nextSegment) {
        let culDeSac = new PIXI.Graphics();
        culDeSac.beginFill().drawCircle(s.end.x, s.end.y, 5).endFill();
        GameApp.Stage.addChild(culDeSac);
      }
    });
  }


}

class RoadSegment {
  start: {x: number, y: number};
  end: {x: number, y: number};
  road: PIXI.DisplayObject;
  previousSegment: RoadSegment;
  nextSegment: RoadSegment?;
  static prints = 0;
  /**
   *
   */
  constructor(startX: number, startY: number, endX: number, endY: number, previousSegment: RoadSegment) {
    this.start = {x: startX, y: startY};
    this.end = {x: endX, y: endY};
    this.road = new PIXI.Graphics();
    this.road.moveTo(startX, startY);
    this.road.lineStyle(5, 0x000000).lineTo(endX, endY);
    this.previousSegment = previousSegment;
    this.nextSegment = null;
  }

  public draw() {

    GameApp.Stage.addChild(this.road);
  }

  public destroy() {
    this.road.destroy();
  }

  public overlaps(segment: RoadSegment) {
    // https://algorithmtutor.com/Computational-Geometry/Check-if-two-line-segment-intersect/
    let p1 = new Point(this.start);
    let p2 = new Point(this.end);
    let p3 = new Point(segment.start);
    let p4 = new Point(segment.end);

    let d1 = p1.minus(p3).cross(p4.minus(p3));
    let d2 = p2.minus(p3).cross(p4.minus(p3));
    let d3 = p3.minus(p1).cross(p2.minus(p1));
    let d4 = p4.minus(p1).cross(p2.minus(p1));
    // if (RoadSegment.prints < 200) console.log(d1, d2, d3, d4);
    // ((d1<0 and d2>0)or((d1>0 and d2<0)) and (d3>0 and d4<0) or (d3<0 and d4>0))
    let result = ((d1 < 0n && d2 > 0n) ||
      ((d1 > 0n && d2 < 0n)) &&
      (d3 > 0n && d4 < 0n) ||
      (d3 < 0n && d4 > 0n));
    // if (RoadSegment.prints < 200) console.log(result);
    // RoadSegment.prints++;
    return result;
  }
}

class Point {
  x, y: BigInt;

  constructor(point: {x: number, y: number}) {
    this.x = BigInt(round(point.x));
    this.y = BigInt(round(point.y));
  }

  public minus(point: Point) {
    return new Point({x: this.x - point.x, y: this.y - point.y});
  }

  public cross(point: Point) {
    return this.x * point.y - point.x * this.y;
  }
}

function round(n: number | BigInt) {
  if (typeof n === 'number') {
    return Math.round(n);
  }
  return n;
}
