import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-games-hub',
  imports: [RouterLink],
  templateUrl: './games-hub.html',
  styleUrl: './games-hub.scss',
  encapsulation: ViewEncapsulation.None
})
export class GamesHub {}
