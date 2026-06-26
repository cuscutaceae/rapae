## rapae

是一只用于爬取XXXXXX资源的微型爬虫！

### 快速上手

> [!CAUTION]
>
> 出于各种原因， rapae 不会提供任何环境变量的具体值

这个仓库主要以 GitHub Actions Workflow 的方式自动化运行，也可以手动执行


#### GitHub Actions

> [!NOTE]
>
> GitHub Actions 具有手动触发器、push触发器和定时触发器，请根据自身需求进行合理修改

1. Fork这个仓库
2. 在 Settings->Secrets and Variables->Actions 中配置以下4个环境变量：

|        环境变量         |                    备注                    |                    示例                    |
| :---------------------: | :----------------------------------------: | :----------------------------------------: |
|   `RAPAE_TARGET_URL`    |      rapae 获取 Bundle 基本信息的 URL      |           `https://api.net/`...            |
|   `RAPAE_VERSION_URL`   | rapae 获取基础版本信息和安装包 URL 的 URL  |           `https://api.net/`...            |
| `SCALES_REPOSITORY_URL` |          scales的 GitHub 仓库地址          | `https://github.com/your_scales/scales`... |
|     `SCALES_TOKEN`      | 能够写入 scales 的 GitHub 仓库的有效 Token |             `github_pat_`....              |

3. 在 Actions->sync output 启动流水线

#### 手动运行

> [!NOTE]
>
> GitHub Actions 方案为 rapae 的自动运行提供了 scirpophaga 集成，而手动运行则 **默认不包含** 这个操作，若有集成的需求，请访问 [scirpophaga](https://github.com/cuscutaceae/scirpophaga) 了解更多

手动运行rapae需要node和npm，如果您没有安装，请先安装

rapae 脚本本身依赖 `RAPAE_TARGET_URL` 和 `RAPAE_VERSION_URL` 两个环境变量，请按需配置，具体作用请参照上文

```shell
git clone https://github.com/cuscutaceae/rapae
cd rapae
npm ci
npm run build # 首先将TypeScript编译至JavaScript

# 您可以直接临时指定环境变量
export RAPAE_TARGET_URL="..."
export RAPAE_VERSION_URL="..."
npm run start working_directory

# ...也可以创建.env.local来注入环境变量
# echo "RAPAE_TARGET_URL=..." >> .env.local
# echo "RAPAE_VERSION_URL=..." >> .env.local
# npm run dev working_directory
```

### 协议

本仓库使用MIT协议