import { GetSprite } from "../assets/loader";
import * as PIXI from "pixi.js";
import { roadsystem, RoadSystem } from './road.ts';

type WorldObject = Player | ScrollingObject;

class Player {
  sprite: PIXI.AnimatedSprite;
  airborne: boolean;
  solid = false;
  verticalSpeed: number;

  public constructor() {
    this.sprite = GetSprite("ghost");
    this.sprite.x = 5;
    this.sprite.anchor.set(0, 1);

    this.sprite.y = GameApp.GroundPosition;
    this.sprite.animationSpeed = 0.05;
    this.sprite.play();

    GameApp.Stage.addChild(this.sprite);
  }

  private collidesWith(otherSprite: PIXI.Sprite) {
    let ab = this.sprite.getBounds();
    let bb = otherSprite.getBounds();
    return !(
      ab.x > bb.x + bb.width ||
      ab.x + ab.width < bb.x ||
      ab.y + ab.height < bb.y ||
      ab.y > bb.y + bb.height
    );
  }

  public Update(delta: number, activeEntities: Array<WorldObject>) {
    if (this.sprite.y >= GameApp.GroundPosition) {
      this.sprite.y = GameApp.GroundPosition;
      this.verticalSpeed = 0;
      this.airborne = false;
    }

    if (this.airborne) {
      this.verticalSpeed += delta / 3;
    }

    if (GameApp.PressedSpace && !this.airborne) {
      this.airborne = true;
      this.verticalSpeed = -5;
    }
    this.sprite.y += this.verticalSpeed * delta;

    for (const currentEntity of GameApp.ActiveEntities) {
      if (currentEntity.solid && this.collidesWith(currentEntity.sprite)) {
        GameApp.GameOver = true;
      }
    }
  }
}

class ScrollingObject {
  sprite: PIXI.AnimatedSprite;
  airborne: boolean;
  solid: boolean = true;

  public constructor(
    spriteName: string,
    x: number,
    y: number,
    isSolid: boolean
  ) {
    this.sprite = GetSprite(spriteName);
    this.sprite.y = y;
    this.sprite.anchor.set(0, 1);
    this.sprite.x = x;
    this.solid = isSolid;
  }

  public Update(delta: number) {
    let baseScrollSpeed = this.solid ?
      GameApp.ScrollSpeed:
      GameApp.ScrollSpeed - 1;
    let scrollSpeed = baseScrollSpeed + Math.min(GameApp.Score / 15.0, 1);
    this.sprite.x -= delta * scrollSpeed;
  }
}

export class GameApp {
  public app: PIXI.Application;
  static ScoreText: PIXI.Text = new PIXI.Text("Score: ", {
    fontSize: 5,
    fill: "#aaff",
    align: "center",
    stroke: "#aaaaaa",
    strokeThickness: 0
  });

  static PressedSpace = false;
  static Stage: PIXI.Container;
  static ActiveEntities: Array<WorldObject> = [];
  static GameOver: boolean = true;
  static ScrollSpeed = 3;
  static ScoreNextObstacle = 0;
  static Score: number = 0;
  static MaxScore = 0;

  static GroundPosition = 0;
  static Width = 0;
  static height = 0;

  constructor(parent: HTMLElement, width: number, height: number) {
    this.app = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x30ff70,
      antialias: false,
      resolution: 3
    });
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    PIXI.settings.SORTABLE_CHILDREN = true;

    GameApp.Stage = this.app.stage;
    GameApp.GroundPosition = height - 1;
    GameApp.Width = width - 1;
    GameApp.height = height;


    // Hack for parcel HMR
    if (parent.lastElementChild)
      parent.replaceChild(this.app.view, parent.lastElementChild);
    else
      parent.appendChild(this.app.view);

    GameApp.SetupGame();

    let roadInstructions = roadsystem.iterate(7);
    this.roadSystem = new RoadSystem(roadInstructions, GameApp.Width, GameApp.height);
  }

  static SetupGame() {
    this.Score = 0;

    this.ActiveEntities = new Array<WorldObject>();
    this.Stage.removeChildren();
  }

  static Update(delta: number) {
    if (!this.GameOver) {
      for (let i = 0; i < GameApp.ActiveEntities.length; i++) {
        const currentEntity = GameApp.ActiveEntities[i];
        currentEntity.Update(delta, GameApp.ActiveEntities);

        if (currentEntity.sprite.x < -20) {
          currentEntity.sprite.destroy();
          GameApp.ActiveEntities.splice(i, 1);
        }
      }
      this.Score += (delta) / 6;

      if (this.Score > this.MaxScore) this.MaxScore = this.Score;
      if (GameApp.ShouldPlaceWorldObject()) {
        GameApp.AddObject(
          Math.random() < 0.75 ? "obstacleGrave" : "obstaclePumpkin",
          GameApp.GroundPosition,
          true
        );

        GameApp.AddObject("cloud", 20, false);
        this.ScoreNextObstacle += this.GetScoreNextObstacle();
      }
    } else {
      if (GameApp.PressedSpace) {
        this.GameOver = false;
        this.SetupGame();
      }
    }

    GameApp.PressedSpace = false;
  }

  static ShouldPlaceWorldObject(): boolean {
    return this.Score >= this.ScoreNextObstacle;
  }

  static GetScoreNextObstacle(): number {
    let minimumDistance = 25;
    let difficulty = Math.min(this.Score / 100, 5);
    return Math.random() * 10 - difficulty * 4 + minimumDistance;
  }

  private static AddObject(
    spriteName: string,
    height: number,
    isSolid: boolean
  ) {
    let obstacle = new ScrollingObject(
      spriteName,
      GameApp.Width,
      height,
      isSolid
    );
    GameApp.ActiveEntities.push(obstacle);
    GameApp.Stage.addChild(obstacle.sprite);
  }
}
