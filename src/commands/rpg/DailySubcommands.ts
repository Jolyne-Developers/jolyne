import { RPGUserDataJSON, SlashCommandFile, Leaderboard, i18n_key } from "../../@types";
import {
    Message,
    APIEmbed,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ButtonStyle,
    InteractionCollector,
    ButtonInteraction,
    CacheType,
    StringSelectMenuInteraction,
    UserSelectMenuInteraction,
    RoleSelectMenuInteraction,
    InteractionResponse,
    MessageComponentInteraction,
} from "discord.js";
import CommandInteractionContext from "../../structures/CommandInteractionContext";
import * as Functions from "../../utils/Functions";
import { FightHandler, FightTypes } from "../../structures/FightHandler";
import { FightableNPCS } from "../../rpg/NPCs";
import { Heaven_Ascended_Dio, Jotaro, Kakyoin } from "../../rpg/NPCs/FightableNPCs";
import { ApplicationCommandOptionType, Utils } from "discord-api-types/v10";
import { StandArrow } from "../../rpg/Items/SpecialItems";
import { getQuestsStats } from "./Chapter";

const slashCommand: SlashCommandFile = {
    data: {
        name: "daily",
        description: "[...]",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "claim",
                description: "Starts your bizarre adventure.",
                type: 1,
            },
            {
                name: "quests",
                description: "Resets all your data from our database.",
                type: 1,
            },
        ],
    },
    execute: async (
        ctx: CommandInteractionContext
    ): Promise<Message<boolean> | void | InteractionResponse<boolean>> => {
        const dateAtMidnight = new Date().setHours(0, 0, 0, 0);
        const nextDate = dateAtMidnight + 86400000;
        switch (ctx.interaction.options.getSubcommand()) {
            case "claim": {
                if (ctx.userData.daily.lastClaimed == dateAtMidnight) {
                    return ctx.sendTranslated("daily:ALREADY_CLAIMED", {
                        time: Functions.generateDiscordTimestamp(
                            Date.now() + (nextDate - Date.now()),
                            "FROM_NOW"
                        ),
                    });
                }
                const rewards = Functions.getRewards(ctx.userData.level);

                Functions.addCoins(ctx.userData, rewards.coins);
                Functions.addXp(ctx.userData, rewards.xp);

                // check if the user last daily was claimed after 2 days
                if (ctx.userData.daily.lastClaimed !== dateAtMidnight - 86400000) {
                    ctx.userData.daily.claimStreak = 0;
                }

                ctx.userData.daily.claimStreak++;
                ctx.userData.daily.lastClaimed = dateAtMidnight;

                let nextGoal = ctx.userData.daily.claimStreak + 1;
                while (nextGoal % 7 !== 0) {
                    nextGoal++;
                }

                let embed_description = ctx.translate("daily:CLAIMED_EMBED_DESCRIPTION", {
                    coins: rewards.coins.toLocaleString("en-US"),
                    xp: rewards.xp.toLocaleString("en-US"),
                });

                if (ctx.client.patreons.find((r) => r.id === ctx.userData.id)) {
                    const xpRewards = Math.round(
                        rewards.xp *
                            (ctx.client.patreons.find((r) => r.id === ctx.userData.id).level / 7 +
                                0.25)
                    );
                    const moneyRewards = Math.round(
                        rewards.coins *
                            (ctx.client.patreons.find((r) => r.id === ctx.userData.id).level / 7 +
                                0.25)
                    );
                    embed_description +=
                        "\n" +
                        ctx.translate("daily:CLAIMED_EMBED_DESCRIPTION_PREMIUM", {
                            coins: moneyRewards.toLocaleString("en-US"),
                            xp: xpRewards.toLocaleString("en-US"),
                            tier: ctx.client.patreons.find((r) => r.id === ctx.userData.id).level,
                        });
                    Functions.addCoins(ctx.userData, moneyRewards);
                    Functions.addXp(ctx.userData, xpRewards);
                }
                if (ctx.client.boosters.find((r) => r === ctx.userData.id)) {
                    Functions.addCoins(ctx.userData, 1000);
                    Functions.addXp(ctx.userData, 1000);
                    embed_description +=
                        "\n" +
                        ctx.translate("daily:CLAIMED_EMBED_DESCRIPTION_BOOSTER", {
                            coins: (1000).toLocaleString("en-US"),
                            xp: (1000).toLocaleString("en-US"),
                        });
                }

                const embed: APIEmbed = {
                    author: {
                        name: ctx.user.tag,
                        icon_url: ctx.user.displayAvatarURL(),
                    },
                    description: embed_description,
                    color: 0x70926c,
                    footer: {
                        text:
                            ctx.translate("daily:CLAIMED_EMBED_FOOTER") +
                            ` ${ctx.userData.daily.claimStreak}/${nextGoal}`,
                    },
                    fields: [
                        {
                            name: ctx.translate("daily:WANT_MORE_HEADER"),
                            value: "[..]",
                        },
                    ],
                };

                if (
                    ctx.client.patreons.find((r) => r.id === ctx.userData.id) &&
                    ctx.client.boosters.find((r) => r === ctx.userData.id)
                ) {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_PREMIUM_BOOSTER"
                    );
                } else if (ctx.client.patreons.find((r) => r.id === ctx.userData.id)) {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_PREMIUM_NON_BOOSTER"
                    );
                } else if (ctx.client.boosters.find((r) => r === ctx.userData.id)) {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_NON_PREMIUM_BOOSTER"
                    );
                } else {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_NON_PREMIUM_NON_BOOSTER"
                    );
                }

                if (ctx.userData.daily.claimStreak % 7 == 0) {
                    let arrows = 0;
                    for (let i = ctx.userData.daily.claimStreak; i > 0; i -= 7) {
                        arrows++;
                    }
                    arrows *= 1.5;
                    arrows = Math.round(arrows);

                    if (arrows > 25) arrows = 25;

                    for (let i = 0; i < arrows; i++) {
                        Functions.addItem(ctx.userData, StandArrow);
                    }
                    embed.fields.push({
                        name: "Streak Bonus",
                        value: `\`x${arrows} ${StandArrow.name}\` ${StandArrow.emoji}`,
                    });
                }

                await ctx.client.database.saveUserData(ctx.userData);

                ctx.makeMessage({
                    embeds: [embed],
                });

                break;
            }
            case "quests": {
                const status = getQuestsStats(ctx.userData.daily.quests, ctx);

                let coinReward = 0;
                let xpReward = 0;

                for (const quest of ctx.userData.daily.quests) {
                    if (Functions.isClaimItemQuest(quest) || Functions.isClaimXQuest(quest)) {
                        coinReward += quest.goal / 5;
                        xpReward += quest.goal / 15;
                        continue;
                    }

                    if (Functions.isFightNPCQuest(quest)) {
                        const npc = Object.values(FightableNPCS).find((r) => r.id === quest.npc);
                        if (!npc) continue;

                        coinReward += npc.level * 100;
                        xpReward += npc.level * 10;
                        continue;
                    }

                    coinReward += 100;
                    xpReward += 75;
                }

                const components: ButtonBuilder[] = [];

                if (Number(status.percent) === 100) {
                    const alreadyClaimed = await ctx.client.database.redis.get(
                        `daily-quests-${ctx.userData.id}`
                    );

                    components.push(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Success)
                            .setEmoji("???")
                            .setCustomId(ctx.interaction.id + "daily-quests-claim")
                            .setDisabled(alreadyClaimed === "true")
                    );
                }

                ctx.makeMessage({
                    content: `:scroll: **__Daily Quests:__** (${status.percent.toFixed(2)}%)\n${
                        status.message
                    }\n\n${ctx.translate("daily:REWARDS_MESSAGE", {
                        coins: coinReward.toLocaleString("en-US"),
                        xp: xpReward.toLocaleString("en-US"),
                        discordUnix: Functions.generateDiscordTimestamp(
                            dateAtMidnight + 86400000,
                            "FROM_NOW"
                        ),
                    })}`,
                    components: components.length !== 0 ? [Functions.actionRow(components)] : [],
                });

                if (components.length > 0) {
                    const filter = (i: MessageComponentInteraction) => {
                        i.deferUpdate().catch(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function

                        return (
                            i.user.id === ctx.user.id &&
                            i.customId === ctx.interaction.id + "daily-quests-claim"
                        );
                    };

                    const collector = ctx.channel.createMessageComponentCollector({
                        filter,
                        time: 15000,
                    });

                    collector.on("collect", async (i) => {
                        /**
                         * Priority:
                         * 1. Check if user is trying to cheat
                         * 2. Save user data
                         * 3. Set daily-quests-<id> to true
                         */
                        const currentRPGJson = JSON.stringify(ctx.userData);
                        ctx.RPGUserData = await ctx.client.database.getRPGUserData(ctx.user.id);

                        if (currentRPGJson !== JSON.stringify(ctx.userData)) {
                            collector.stop("cheater");
                            return;
                        }

                        Functions.addCoins(ctx.userData, coinReward);
                        Functions.addXp(ctx.userData, xpReward);

                        await ctx.client.database.saveUserData(ctx.userData);
                        await ctx.client.database.redis.set(
                            `daily-quests-${ctx.userData.id}`,
                            "true"
                        );

                        ctx.makeMessage({
                            components: [Functions.actionRow([components[0].setDisabled(true)])],
                        });

                        ctx.followUp({
                            content: ctx.translate("daily:REWARDS_CLAIM_MESSAGE", {
                                coins: coinReward.toLocaleString("en-US"),
                                xp: xpReward.toLocaleString("en-US"),
                            }),
                        });
                    });
                }
                break;
            }
        }
    },
};

export default slashCommand;
