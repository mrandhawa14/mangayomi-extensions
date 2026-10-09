import 'dart:convert';
import 'dart:developer';
import 'dart:io';

import 'dart/anime/anime_source_list.dart';
import 'dart/manga/manga_source_list.dart';
import 'dart/novel/novel_source_list.dart';
import 'model/source.dart';

const _upstreamRawRepository =
    "raw.githubusercontent.com/m2k3a/mangayomi-extensions/";
const _ownedRawRepository =
    "raw.githubusercontent.com/mrandhawa14/mangayomi-extensions/";

void main() {
  final jsSources = _searchJsSources(Directory("javascript"));
  genManga(
    jsSources.where((element) => element.itemType!.name == "manga").toList(),
  );
  genAnime(
    jsSources.where((element) => element.itemType!.name == "anime").toList(),
  );
  genNovel(
    jsSources.where((element) => element.itemType!.name == "novel").toList(),
  );
}

void genManga(List<Source> jsMangasourceList) {
  List<Source> mangaSources = [];
  mangaSources.addAll(dartMangasourceList);
  mangaSources.addAll(jsMangasourceList);
  final jsonList = _uniqueSourceJson(mangaSources);
  final jsonString = jsonEncode(jsonList);

  final file = File('index.json');
  file.writeAsStringSync(jsonString);

  log('JSON file created: ${file.path}');
}

void genAnime(List<Source> jsAnimesourceList) {
  List<Source> animeSources = [];
  animeSources.addAll(dartAnimesourceList);
  animeSources.addAll(jsAnimesourceList);
  final jsonList = _uniqueSourceJson(animeSources);
  final jsonString = jsonEncode(jsonList);

  final file = File('anime_index.json');
  file.writeAsStringSync(jsonString);

  log('JSON file created: ${file.path}');
}

void genNovel(List<Source> jsNovelSourceList) {
  List<Source> novelSources = [];
  novelSources.addAll(dartNovelSourceList);
  novelSources.addAll(jsNovelSourceList);
  final jsonList = _uniqueSourceJson(novelSources);
  final jsonString = jsonEncode(jsonList);

  final file = File('novel_index.json');
  file.writeAsStringSync(jsonString);

  log('JSON file created: ${file.path}');
}

Map<String, dynamic> _ownedSourceJson(Source source) {
  return source.toJson().map((key, value) {
    if (value is String) {
      return MapEntry(
        key,
        value.replaceAll(_upstreamRawRepository, _ownedRawRepository),
      );
    }
    return MapEntry(key, value);
  });
}

List<Map<String, dynamic>> _uniqueSourceJson(Iterable<Source> sources) {
  final seen = <String>{};
  return sources.map(_ownedSourceJson).where((source) {
    return seen.add(jsonEncode(source));
  }).toList();
}

List<Source> _searchJsSources(Directory dir) {
  List<Source> sourceList = [];
  List<FileSystemEntity> entities = dir.listSync();
  for (FileSystemEntity entity in entities) {
    if (entity is Directory) {
      List<FileSystemEntity> entities = entity.listSync();
      for (FileSystemEntity entity in entities) {
        if (entity is Directory) {
          sourceList.addAll(_searchJsSources(entity));
        } else if (entity is File && entity.path.endsWith('.js')) {
          final sourcePath = entity.path
              .replaceAll('\\', '/')
              .split('javascript/')
              .last;
          final regex = RegExp(
            r'const\s+mangayomiSources\s*=\s*(\[.*?\]);',
            dotAll: true,
          );
          final defaultSource = Source();
          final match = regex.firstMatch(entity.readAsStringSync());
          if (match != null) {
            for (var sourceJson in jsonDecode(match.group(1)!) as List) {
              final langs = sourceJson["langs"] as List?;
              Source source = Source.fromJson(sourceJson)
                ..sourceCodeLanguage = 1
                ..appMinVerReq =
                    sourceJson["appMinVerReq"] ?? defaultSource.appMinVerReq
                ..sourceCodeUrl =
                    "https://raw.githubusercontent.com/mrandhawa14/mangayomi-extensions/$branchName/javascript/$sourcePath";
              if (sourceJson["id"] != null) {
                source = source..id = int.tryParse("${sourceJson["id"]}");
              }
              if (langs?.isNotEmpty ?? false) {
                for (var lang in langs!) {
                  final id = sourceJson["ids"]?[lang] as int?;
                  sourceList.add(
                    Source.fromJson(source.toJson())
                      ..lang = lang
                      ..id =
                          id ??
                          'mangayomi-js-"$lang"."${source.name}"'.hashCode,
                  );
                }
              } else {
                sourceList.add(source);
              }
            }
          }
        }
      }
    }
  }
  return sourceList;
}
