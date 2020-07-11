// for readability
import { basename } from 'path';
import {
  readWorkspaceFile,
  parseNoteTitleFromMarkdown,
  parseNoteLinksFromMarkdown,
} from './utils/utils';

type ID = string;
type Index = Map<ID, Set<ID>>;

export interface Note {
  /**
   * Base name of the file without extension, e.g. wiki-link
   */
  original: ID;
  clean: string;
  title: string;
  filename: string;
  extension: string;
  absolutePath: string;
  markdown: string; // do we need this?
}

export interface NoteWithLinks extends Note {
  /**
   * Notes referenced from this note (wikilinks)
   */
  linkedNotes: Note[];

  /**
   * Notes that reference this note (backlinks) */
  backlinks: Note[];
}

function getOrInitializeIndexForId(index: Index, id: ID): Set<ID> {
  let links: Set<ID>;
  if (index.has(id)) {
    links = index.get(id)!;
  } else {
    index.set(id, (links = new Set<ID>()));
  }

  return links;
}

export class WorkspaceManager {
  /**
   * Workspace base path
   */
  path: string;
  /**
   * Note metadata for files in this workspace, keyed by id
   */
  notes: Map<ID, Note> = new Map();

  /**
   * Link index A->B
   */
  linksFromNoteById: Index = new Map();

  /**
   * Reverse backlinks B->A
   */
  linksBackToNoteById: Index = new Map();

  constructor(path: string, notes: Note[] = []) {
    this.path = path;
    this.notes = new Map<ID, Note>(notes.map(note => [note.clean, note]));
  }

  public getNoteWithLinks(id: ID): NoteWithLinks | null {
    const note = this.notes.get(id);
    if (!note) {
      return null;
    }

    const linkedNotes = Array.from(
      getOrInitializeIndexForId(this.linksFromNoteById, id)
    )
      .map(id => this.notes.get(id))
      .filter(Boolean) as Note[];

    const backlinks = Array.from(
      getOrInitializeIndexForId(this.linksBackToNoteById, id)
    )
      .map(id => this.notes.get(id))
      .filter(Boolean) as Note[];

    return {
      ...note,
      linkedNotes,
      backlinks,
    };
  }

  /**
   *
   * @param filename File name relative to workspace path
   */
  public async addNoteByFilePath(filePath: string): Promise<Note> {
    return await this.addNoteFromMarkdown(
      this.path,
      await readWorkspaceFile(filePath)
    );
  }

  public cleanPath (path: string): string {
    const slug = '-'; //perhaps a config would be a better choice;
    return path
      .replace(/[!"\#$%&'()*+,\-./:;<=>?@\[\\\]^_‘{|}~\s]+/gi, slug)
      .toLowerCase() // lower
      .replace(/[-_－＿ ]*$/g, ''); // removing trailing slug chars
  }
  
  public addNoteFromMarkdown(absolutePath: string, markdown: string): Note {
    // parse markdown
    const filename = basename(absolutePath);

    const parts = filename.split('.');
    const extension = parts.pop()!;
    const original = parts.join('.')
    const clean = this.cleanPath(original);
    const title = parseNoteTitleFromMarkdown(markdown);
    const note: Note = {
      clean,
      original,
      title: title || original,
      filename,
      absolutePath,
      extension,
      markdown,
    };

    // extract linksTo
    return this.addNote(note);
  }

  public addNote(note: Note): Note {
    const linkIds = parseNoteLinksFromMarkdown(note.markdown).map(v => {
      return {
        original: v, 
        clean: this.cleanPath(v)
      }
    });

    this.notes.set(note.clean, note);

    if (linkIds.length > 0) {
      let linksFromNote = getOrInitializeIndexForId(
        this.linksFromNoteById,
        note.clean
      );

      for (const link of linkIds) {
        linksFromNote.add(link.clean);
        getOrInitializeIndexForId(this.linksBackToNoteById, link.clean).add(note.clean);
      }
    }

    return note;
  }

  /*
  // Clearly I'm too tired to do this right now
  public removeNote(a: ID): Note | null {
    let note = this.notes.get(a);
    if (!note) {
      return null;
    }

    // find references from this note to others
    let linksFromNote = getOrInitializeIndexForId(this.linksFromNoteById, a);

    // remove the index
    this.linksFromNoteById.delete(a);

    // find all notes that reference the note we are deleting
    for (const b in linksFromNote) {
      const backlinks = getOrInitializeIndexForId(this.linksBackToNoteById, b);
      if (backlinks.has(a)) {
        // @todo, trigger event?
        backlinks.delete(a);
      }
    }

    return note;
  }
  

  // @ts-expect-error
  public renameNote(note: Note, newFilename: string) {
    throw new Error('Not implemented');
  }
  */
}
