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
          successors: [{weight: 100, successor: 'FF'}]
        }
      }
});

export class RoadSystem {
  segments: RoadSegment[];
  grid: Grid;

  constructor(instructions: string, width: number, height: number) {
    let angle = 0.0, x = width/2, y = height/2, roadEnded = false, previousSegment = null;
    let tileCountX = Math.floor(width/10);
    let tileCountY = Math.floor(height/10);
    let tileX = Math.floor(tileCountX/2), tileY = Math.floor(tileCountY/2);
    this.segments = [];
    this.grid = new Grid(10, 10);
    let direction = 'down';
    let stack = [];
    for (let char of instructions) {
      let deltaX, deltaY, state, newX, newY, segment, culDeSac;
      switch (char) {
        case 'F':
          // forward
          segment = new Tile(this.edgesFromDirection(direction));
          if (this.grid.hasNonEmptyTileAt(tileX, tileY)) {
            segment.destroy();
          } else {
            this.grid.push(segment, tileX, tileY);
          }
          tileX += direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
          tileY += direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
          tileX = Math.min(tileCountX, Math.max(0, tileX));
          tileY = Math.min(tileCountY, Math.max(0, tileY));
          break;
        case '-':
          // -pi/2 radians to angle
          direction = this.turnClockwise(direction);
          break;
        case '+':
          // +pi/2 radians to angle
          direction = this.turnCounterClockwise(direction);
          break;
        case '[':
          // push position and angle
          stack.push({x, y, angle, roadEnded, previousSegment, direction, tileX, tileY});
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
          direction = state.direction;
          tileX = state.tileX;
          tileY = state.tileY;
          break;
        case 'X':
          break;
        default:
          console.warn(`RoadSystem doesn't understand ${char}`);
          break;
      }
    }
    this.grid.draw();
  }

  edgesFromDirection(direction: Direction) {
    return {
      up: {top: true, bottom: true, left: false, right: false},
      down: {top: true, bottom: true, left: false, right: false},
      left: {top: false, bottom: false, left: true, right: true},
      right: {top: false, bottom: false, left: true, right: true},
    }[direction];
  }

  turnClockwise(direction: Direction) {
    return {
      up: 'right',
      down: 'left',
      left: 'up',
      right: 'down'
    }[direction];
  }

  turnCounterClockwise(direction: Direction)  {
    return {
      up: 'left',
      down: 'right',
      left: 'down',
      right: 'up'
    }[direction];
  }
}

type Direction = 'up' | 'down' | 'left' | 'right';

class Grid {
  grid: Tile[][];
  tileWidth, tileHeight: number;

  constructor(tileWidth: number, tileHeight: number) {
    this.grid = [];
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  public hasNonEmptyTileAt(x: number, y: number) {
    if (!(this.grid[x] && this.grid[x][y])) {
      return false;
    }
    return this.grid[x][y].isNonEmpty();
  }

  public push(tile: Tile, x: number, y: number) {
    if (!this.grid[x]) {
      this.grid[x] = [];
    }
    this.grid[x][y] = tile;
  }

  draw() {
    this.grid.forEach((column, i) => {
      column.forEach((tile, j) => {
        tile.draw(i * this.tileWidth, j * this.tileHeight, this.tileWidth, this.tileHeight);
      });
    });
  }
}

type Edges = {
  top: boolean,
  right: boolean,
  left: boolean,
  bottom: boolean
};

class Tile {
  edges: Edges;
  road: PIXI.DisplayObject;


  constructor(edges: Edges) {
    this.edges = edges;
    this.road = null;
  }

  destroy() {
    this.edges = null;
    this.road?.destroy();
  }

  isNonEmpty() {
    return Object.values(this.edges).some(x => x);
  }

  isEmpty() {
    return !this.isNonEmpty();
  }

  draw(x: number, y: number, width: number, height: number) {
    this.road = new PIXI.Graphics();
    let startX, startY, endX, endY;
    if (this.edges.top && this.edges.bottom) {
      startX = x + width/2;
      startY = y;
      endX = x + width/2;
      endY = y + height;
    } else if (this.edges.left && this.edges.right) {
      startX = x;
      startY = y + height/2;
      endX = x + height;
      endY = y + height/2;
    } else if (this.isEmpty()) {

    } else {
      console.warn('tile not drawn');
    }

    this.road.moveTo(startX, startY);
    this.road.lineStyle(5, 0x000000).lineTo(endX, endY);
    GameApp.Stage.addChild(this.road);

  }
}
