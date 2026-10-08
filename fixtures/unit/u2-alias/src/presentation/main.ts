// F-ALIAS (business-rules.md §8): one statement per alias rule under test.
import { X } from '@app/domain/x';
import { Y } from 'src/domain/y';
import { X as TildeX } from '~/domain/x';
import { M } from '@app/missing';
import { N } from 'src/missing';
import { L } from '@libs/x';
import cfg from 'config';
import pg from '@internal/pg';

export const used = [X, Y, TildeX, M, N, L, cfg, pg];
