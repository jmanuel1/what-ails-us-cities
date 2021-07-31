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
    this.grid = new Grid(10, 10, tileCountX, tileCountY);
    let direction = 'down';
    let stack = [];
    for (let char of instructions) {
      let deltaX, deltaY, state, newX, newY, segment, culDeSac;
      switch (char) {
        case 'F':
          // forward
          if (this.grid.hasNonEmptyTileAt(tileX, tileY)) {
            let edges = this.grid.at(tileX, tileY).edges;
            Object.assign(edges, this.edgesFromDirection(direction));
          } else {
            segment = new Tile(this.edgesFromDirection(direction));
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
    this.grid.fixIntersections();
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
  tileWidth, tileHeight, width, height: number;

  constructor(tileWidth: number, tileHeight: number, width: number, height: number) {
    this.grid = [];
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.width = width;
    this.height = height;
  }

  public hasNonEmptyTileAt(x: number, y: number) {
    if (!(this.grid[x] && this.grid[x][y])) {
      return false;
    }
    return this.grid[x][y].isNonEmpty();
  }

  at(tileX: number, tileY: number) {
    return this.grid[tileX] && this.grid[tileX][tileY];
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
        tile.draw(i * this.tileWidth, j * this.tileHeight, this.tileWidth, this.tileHeight, this);
      });
    });
  }

  fixIntersections() {
    this.grid.forEach((column, i) => {
      column.forEach((tile, j) => {
        if (tile.edges.left) {
          if (i > 0 && this.hasNonEmptyTileAt(i - 1, j)) {
            let neighbor = this.at(i - 1, j);
            if (neighbor.edges.top && neighbor.edges.bottom) {
              neighbor.edges.right = true;
            }
          }
        }
        if (tile.edges.right) {
          if (i <= this.grid.length && this.hasNonEmptyTileAt(i + 1, j)) {
            let neighbor = this.at(i + 1, j);
            if (neighbor.edges.top && neighbor.edges.bottom) {
              neighbor.edges.left = true;
            }
          }
        }
        if (tile.edges.top) {
          if (j > 0 && this.hasNonEmptyTileAt(i, j - 1)) {
            let neighbor = this.at(i, j - 1);
            if (neighbor.edges.left && neighbor.edges.right) {
              neighbor.edges.bottom = true;
            }
          }
        }
        if (tile.edges.bottom) {
          if (j <= column.length && this.hasNonEmptyTileAt(i, j + 1)) {
            let neighbor = this.at(i, j + 1);
            if (neighbor.edges.left && neighbor.edges.right) {
              neighbor.edges.top = true;
            }
          }
        }
      });

    });
    this.grid.forEach((column, i) => {
      column.forEach((tile, j) => {
        if (tile.edges.left) {
          if (i > 0 && !this.hasNonEmptyTileAt(i - 1, j)) {
            this.push(new Tile({right: true}, {culDeSac: true}), i - 1, j));
          }
        }
        if (tile.edges.right) {
          if (i <= this.grid.length && !this.hasNonEmptyTileAt(i + 1, j)) {
            this.push(new Tile({left: true}, {culDeSac: true}), i + 1, j));

          }
        }
        if (tile.edges.top) {
          if (j > 0 && !this.hasNonEmptyTileAt(i, j - 1)) {
            this.push(new Tile({bottom: true}, {culDeSac: true}), i, j - 1));

          }
        }
        if (tile.edges.bottom) {
          if (j <= column.length && !this.hasNonEmptyTileAt(i, j + 1)) {
            this.push(new Tile({top: true}, {culDeSac: true}), i, j + 1));

          }
        }
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
  isCulDeSac: boolean;
  x, y: number;


  constructor(edges: Edges, options: {culDeSac: boolean} = {culDeSac: false}) {
    this.edges = edges;
    this.road = null;
    this.isCulDeSac = options.culDeSac;
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

  draw(x: number, y: number, width: number, height: number, grid: Grid) {
    this.road = new PIXI.Graphics();
    this.x = x;
    this.y = y;
    let startX, startY, endX, endY;
    const roadColor = 0x333333;
    const houseColor = 0xaa8855;
    if (this.edges.top) {
      startX = x + width/2;
      startY = y;
      endX = x + width/2;
      endY = y + height/2;

      if (this.isCulDeSac) {
        this.road.beginFill(roadColor).drawCircle(startX, startY, 5).endFill();
      } else {
        this.road.lineStyle(1, houseColor).drawRect(x, y + height/4, 1, 1);
        this.road.lineStyle(1, houseColor).drawRect(x + width, y + height/4, 1, 1);
        this.road.moveTo(startX, startY);
        this.road.lineStyle(5, roadColor).lineTo(endX, endY);
      }
    }
    if (this.edges.bottom) {
      startX = x + width/2;
      startY = y + height/2;
      endX = x + width/2;
      endY = y + height;
      if (this.isCulDeSac) {
        this.road.beginFill(roadColor).drawCircle(endX, endY, 5).endFill();
      } else {
        this.road.moveTo(startX, startY);
        this.road.lineStyle(5, roadColor).lineTo(endX, endY);
      }
    }
    if (this.edges.left) {
      startX = x;
      startY = y + height/2;
      endX = x + width/2;
      endY = y + height/2;

      if (this.isCulDeSac) {
        this.road.beginFill(roadColor).drawCircle(startX, startY, 5).endFill();
      } else {
        this.road.moveTo(startX, startY);
        this.road.lineStyle(5, roadColor).lineTo(endX, endY);
      }
    }
    if (this.edges.right) {
      startX = x + width/2;
      startY = y + height/2;
      endX = x + width;
      endY = y + height/2;

      if (this.isCulDeSac) {
        this.road.beginFill(roadColor).drawCircle(endX, endY, 5).endFill();
      } else {
        this.road.moveTo(startX, startY);
        this.road.lineStyle(5, roadColor).lineTo(endX, endY);
      }
    }

    this.road.interactive = true;
    let text = null, tooltip = null;
    this.road.on('mouseover', () => {
      text = new PIXI.Text(`maintenance cost: 2000/year\nassociated revenue: ${this.associatedRevenue(grid)}/year`, {fontSize: 5, fill: 0x000000});
      text.x = x;
      text.y = y;
      tooltip = new PIXI.Graphics()./*lineStyle(1, 0xe0e0e0).*/beginFill(0xe0e0e0).drawRect(x, y, text.width, text.height).endFill();
      tooltip.zIndex = 1;
      text.zIndex = 2;
      GameApp.Stage.addChild(tooltip, text/*, tooltip*/);
    });
    this.road.on('mouseout', () => {
      text.destroy();
      tooltip.destroy();
    });

    this.road.hitArea = this.road.getBounds();
    GameApp.Stage.addChild(this.road);

  }

  associatedRevenue(grid: Grid) {
    let nearbyHouses = 2;
    let propertyTax = 200 * nearbyHouses;
    let nearbyServiceUsage = this.nearbyNonEmptyTilesInNSteps(5, grid);
    let nearbyServiceRevenue = 50 * nearbyServiceUsage;
    return propertyTax + nearbyServiceRevenue;
  }

  nearbyNonEmptyTilesInNSteps(n: number, grid: Grid) {
    let nearby = new Set([this]);
    let nearby2 = new Set(nearby);
    let changed = true;
    while (changed && n > 0) {
      changed = false;
      n--;
      nearby.forEach(tile => {
        let i = Math.floor(tile.x/grid.tileWidth), j = Math.floor(tile.y/grid.tileHeight);
        if (tile.edges.left) {
          if (i > 0 && grid.hasNonEmptyTileAt(i - 1, j)) {
            nearby2.add(grid.at(i - 1, j));
            changed = true;
          }
        }
        if (tile.edges.right) {
          if (i <= grid.width && grid.hasNonEmptyTileAt(i + 1, j)) {
            nearby2.add(grid.at(i + 1, j));
            changed = true;

          }
        }
        if (tile.edges.top) {
          if (j > 0 && grid.hasNonEmptyTileAt(i, j - 1)) {
            nearby2.add(grid.at(i, j - 1));
            changed = true;

          }
        }
        if (tile.edges.bottom) {
          if (j <= grid.height && grid.hasNonEmptyTileAt(i, j + 1)) {
            nearby2.add(grid.at(i, j + 1));
            changed = true;

          }
        }
      });
      nearby = nearby2;
      nearby2 = new Set(nearby);
    }
    return nearby.size - 1;
  }
}
